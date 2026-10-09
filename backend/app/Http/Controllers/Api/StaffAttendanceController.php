<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\User;
use App\Services\StaffAttendanceService;
use App\Services\StaffQrCredentialService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class StaffAttendanceController extends Controller
{
    public function __construct(
        private readonly StaffAttendanceService $attendanceService,
        private readonly StaffQrCredentialService $qrCredentials,
    )
    {
    }

    public function today(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isStaff(), 403);
        $staffId = $request->user()->isAdmin() && $request->filled('staff_id') ? $request->staff_id : $request->user()->id;
        $record = StaffAttendance::query()
            ->where('staff_id', $staffId)
            ->whereNotNull('time_in_at')
            ->whereNull('time_out_at')
            ->latest('time_in_at')
            ->first();
        if (!$record) {
            $record = StaffAttendance::query()
                ->where('staff_id', $staffId)
                ->whereDate('time_in_at', now('Asia/Manila')->toDateString())
                ->latest('time_in_at')
                ->first();
        }
        $state = $this->attendanceService->describe($record);
        $now = now(StaffAttendanceService::TIMEZONE);
        $canSelfTimeOut = $record && !$record->time_out_at && $record->time_in_at->copy()->setTimezone(StaffAttendanceService::TIMEZONE)->isSameDay($now);
        return response()->json(['data' => $record, 'on_duty' => $state['status'] === 'on_duty', 'attendance_state' => $state, 'can_self_time_out' => $canSelfTimeOut]);
    }

    public function history(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isStaff(), 403);
        $query = StaffAttendance::with(['staff:id,name,staff_type', 'recorder:id,name'])->latest('time_in_at');
        if (!$request->user()->isAdmin()) $query->where('staff_id', $request->user()->id);
        if ($request->filled('staff_id')) $query->where('staff_id', $request->staff_id);
        if ($request->filled('from')) $query->whereDate('time_in_at', '>=', $request->from);
        if ($request->filled('to')) $query->whereDate('time_in_at', '<=', $request->to);
        return response()->json(['data' => $query->paginate(min($request->integer('per_page', 25), 100))]);
    }

    public function summary(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);

        $onDuty = StaffAttendance::query()
            ->with('staff:id,name')
            ->whereNotNull('time_in_at')
            ->whereNull('time_out_at')
            ->latest('time_in_at')
            ->get();

        $groups = $onDuty->map(fn (StaffAttendance $attendance) => [
            'id' => $attendance->staff_id,
            'name' => $attendance->staff?->name,
            'attendance_id' => $attendance->id,
            'time_in_at' => $attendance->time_in_at,
            ...$this->attendanceService->describe($attendance),
        ])->groupBy(fn (array $row) => $row['status']);

        return response()->json([
            'data' => [
                'count' => $groups->get('on_duty', collect())->count(),
                'names' => $groups->get('on_duty', collect())->pluck('name')->filter()->values(),
                'needs_review_count' => $groups->get('missing_time_out', collect())->count(),
                'needs_review' => $groups->get('missing_time_out', collect())->values(),
            ],
        ]);
    }

    public function identifyQr(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isStaff(), 403);
        $validated = $request->validate(['credential' => 'required|string|max:2048']);
        $staff = $this->qrCredentials->resolve($validated['credential']);
        if (!$staff) {
            return response()->json(['message' => 'Invalid, revoked, or inactive staff QR credential.'], 422);
        }

        $active = StaffAttendance::query()
            ->where('staff_id', $staff->id)
            ->whereNull('time_out_at')
            ->latest('time_in_at')
            ->first();
        $state = $this->attendanceService->describe($active);
        $requiresReview = $active
            && $state['status'] === 'missing_time_out'
            && !$active->time_in_at->copy()->setTimezone(StaffAttendanceService::TIMEZONE)->isSameDay(now(StaffAttendanceService::TIMEZONE));

        return response()->json([
            'data' => [
                'staff' => [
                    'id' => $staff->id,
                    'display_id' => $staff->display_id,
                    'name' => $staff->name,
                    'staff_type' => $staff->staff_type,
                ],
                'attendance_state' => $state,
                'next_action' => $requiresReview ? 'needs_review' : ($active ? 'time_out' : 'time_in'),
            ],
        ]);
    }

    public function qrTimeIn(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isStaff(), 403);
        $validated = $request->validate(['credential' => 'required|string|max:2048']);
        $staff = $this->qrCredentials->resolve($validated['credential']);
        if (!$staff) {
            return response()->json(['message' => 'Invalid, revoked, or inactive staff QR credential.'], 422);
        }

        $record = DB::transaction(function () use ($staff, $validated, $request) {
            $lockedStaff = User::query()->whereKey($staff->id)->lockForUpdate()->first();
            if (!$lockedStaff || !$lockedStaff->is_active || !$this->qrCredentials->matches($lockedStaff, $validated['credential'])) {
                return 'invalid_credential';
            }

            $active = StaffAttendance::query()
                ->where('staff_id', $lockedStaff->id)
                ->whereNull('time_out_at')
                ->lockForUpdate()
                ->first();
            if ($active) {
                return null;
            }

            return StaffAttendance::create([
                'staff_id' => $lockedStaff->id,
                'time_in_at' => now(StaffAttendanceService::TIMEZONE),
                'timezone' => StaffAttendanceService::TIMEZONE,
                'recorded_by' => $request->user()->id,
                'recording_method' => 'qr_admin',
            ]);
        });

        if ($record === 'invalid_credential') {
            return response()->json(['message' => 'Invalid, revoked, or inactive staff QR credential.'], 422);
        }
        if (!$record) {
            return response()->json(['message' => 'This staff member is already timed in.'], 422);
        }

        return response()->json(['data' => $record->load('staff:id,name,staff_type')], 201);
    }

    public function qrTimeOut(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isStaff(), 403);
        $validated = $request->validate(['credential' => 'required|string|max:2048']);
        $staff = $this->qrCredentials->resolve($validated['credential']);
        if (!$staff) {
            return response()->json(['message' => 'Invalid, revoked, or inactive staff QR credential.'], 422);
        }

        $result = DB::transaction(function () use ($staff, $validated, $request) {
            $lockedStaff = User::query()->whereKey($staff->id)->lockForUpdate()->first();
            if (!$lockedStaff || !$lockedStaff->is_active || !$this->qrCredentials->matches($lockedStaff, $validated['credential'])) {
                return 'invalid_credential';
            }

            $record = StaffAttendance::query()
                ->where('staff_id', $lockedStaff->id)
                ->whereNull('time_out_at')
                ->latest('time_in_at')
                ->lockForUpdate()
                ->first();
            if (!$record) {
                return null;
            }

            $state = $this->attendanceService->describe($record);
            $timeIn = $record->time_in_at->copy()->setTimezone(StaffAttendanceService::TIMEZONE);
            if ($state['status'] === 'missing_time_out' && !$timeIn->isSameDay(now(StaffAttendanceService::TIMEZONE))) {
                return 'needs_review';
            }

            $record->update([
                'time_out_at' => now(StaffAttendanceService::TIMEZONE),
                'recorded_by' => $request->user()->id,
                'recording_method' => 'qr_admin',
            ]);

            return $record->fresh()->load('staff:id,name,staff_type');
        });

        if ($result === 'invalid_credential') {
            return response()->json(['message' => 'Invalid, revoked, or inactive staff QR credential.'], 422);
        }
        if ($result === 'needs_review') {
            return response()->json(['message' => 'This attendance record needs admin review because it is past the expected closing window.'], 422);
        }
        if (!$result) {
            return response()->json(['message' => 'No active time-in record was found for this staff member.'], 422);
        }

        return response()->json(['data' => $result]);
    }

    public function timeIn(Request $request)
    {
        abort_unless($request->user()->isStaff(), 403);
        $staffId = $request->user()->id;
        $record = DB::transaction(function () use ($staffId) {
            User::query()->whereKey($staffId)->lockForUpdate()->firstOrFail();
            $active = StaffAttendance::query()->where('staff_id', $staffId)->whereNull('time_out_at')->lockForUpdate()->first();
            if ($active) return null;
            return StaffAttendance::create([
                'staff_id' => $staffId,
                'time_in_at' => now(StaffAttendanceService::TIMEZONE),
                'timezone' => StaffAttendanceService::TIMEZONE,
                'recorded_by' => $staffId,
                'recording_method' => 'self',
            ]);
        });
        if (!$record) return response()->json(['message' => 'You are already timed in.'], 422);
        return response()->json(['data' => $record], 201);
    }

    public function timeOut(Request $request)
    {
        abort_unless($request->user()->isStaff(), 403);
        $record = DB::transaction(function () use ($request) {
            User::query()->whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $record = StaffAttendance::query()->where('staff_id', $request->user()->id)->whereNull('time_out_at')->latest('time_in_at')->lockForUpdate()->first();
            if (!$record) return null;
            $state = $this->attendanceService->describe($record);
            $timeIn = $record->time_in_at->copy()->setTimezone(StaffAttendanceService::TIMEZONE);
            if ($state['status'] === 'missing_time_out' && !$timeIn->isSameDay(now(StaffAttendanceService::TIMEZONE))) return 'needs_review';
            $record->update([
                'time_out_at' => now(StaffAttendanceService::TIMEZONE),
                'recorded_by' => $request->user()->id,
                'recording_method' => 'self',
            ]);
            return $record->fresh();
        });
        if ($record === 'needs_review') return response()->json(['message' => 'This attendance record needs admin review because it is past the expected closing window.'], 422);
        if (!$record) return response()->json(['message' => 'No active time-in record was found.'], 422);
        return response()->json(['data' => $record]);
    }

    public function adminTimeIn(Request $request, User $staff)
    {
        abort_unless($request->user()->isAdmin(), 403);
        abort_unless($staff->isStaff(), 422, 'Selected user is not staff.');
        $record = DB::transaction(function () use ($staff, $request) {
            User::query()->whereKey($staff->id)->lockForUpdate()->firstOrFail();
            $active = StaffAttendance::query()->where('staff_id', $staff->id)->whereNull('time_out_at')->lockForUpdate()->first();
            if ($active) return null;
            return StaffAttendance::create([
                'staff_id' => $staff->id,
                'time_in_at' => now(StaffAttendanceService::TIMEZONE),
                'timezone' => StaffAttendanceService::TIMEZONE,
                'recorded_by' => $request->user()->id,
                'recording_method' => 'manual_admin',
            ]);
        });
        if (!$record) return response()->json(['message' => 'This staff member is already timed in.'], 422);
        return response()->json(['data' => $record->load('staff:id,name,staff_type')], 201);
    }

    public function adminTimeOut(Request $request, User $staff)
    {
        abort_unless($request->user()->isAdmin(), 403);
        abort_unless($staff->isStaff(), 422, 'Selected user is not staff.');
        $record = DB::transaction(function () use ($staff, $request) {
            User::query()->whereKey($staff->id)->lockForUpdate()->firstOrFail();
            $record = StaffAttendance::query()->where('staff_id', $staff->id)->whereNull('time_out_at')->latest('time_in_at')->lockForUpdate()->first();
            if (!$record) return null;
            $record->update([
                'time_out_at' => now(StaffAttendanceService::TIMEZONE),
                'recorded_by' => $request->user()->id,
                'recording_method' => 'manual_admin',
            ]);
            return $record->fresh();
        });
        if (!$record) return response()->json(['message' => 'No active time-in record was found for this staff member.'], 422);
        return response()->json(['data' => $record->load('staff:id,name,staff_type')]);
    }

    public function correctTimeOut(Request $request, StaffAttendance $staffAttendance)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validated = $request->validate([
            'time_out_at' => 'required|date',
            'reason' => 'required|string|max:500',
        ]);
        if ($staffAttendance->time_out_at) return response()->json(['message' => 'This attendance record already has a Time Out.'], 422);

        try {
            $timeOut = Carbon::parse($validated['time_out_at'], StaffAttendanceService::TIMEZONE)->setTimezone(StaffAttendanceService::TIMEZONE);
        } catch (\Throwable) {
            return response()->json(['message' => 'Time Out must be a valid date and time.'], 422);
        }
        $timeIn = $staffAttendance->time_in_at->copy()->setTimezone(StaffAttendanceService::TIMEZONE);
        if ($timeOut->lessThanOrEqualTo($timeIn)) return response()->json(['message' => 'Time Out must be after Time In.'], 422);
        if ($timeOut->greaterThan(now(StaffAttendanceService::TIMEZONE))) return response()->json(['message' => 'Time Out cannot be in the future.'], 422);

        $staffAttendance->update([
            'time_out_at' => $timeOut,
            'timezone' => StaffAttendanceService::TIMEZONE,
            'recorded_by' => $request->user()->id,
            'recording_method' => 'admin_correction',
        ]);
        return response()->json(['data' => $staffAttendance->fresh()->load('staff:id,name,staff_type'), 'reason' => trim($validated['reason'])]);
    }
}
