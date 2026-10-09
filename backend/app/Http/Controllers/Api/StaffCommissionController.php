<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\CommissionSetting;
use App\Models\StaffCommission;
use App\Models\User;
use App\Services\StaffCommissionService;
use Illuminate\Http\Request;

class StaffCommissionController extends Controller
{
    public function __construct(private readonly StaffCommissionService $commissionService)
    {
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->isAdmin() || $request->user()->isGroomer(), 403);
        $query = StaffCommission::with(['staff:id,name,staff_type', 'service:id,name,category', 'appointment:id,appointment_code,booking_source'])->latest('earned_at');
        if (!$request->user()->isAdmin()) $query->where('staff_id', $request->user()->id);
        if ($request->filled('staff_id')) $query->where('staff_id', $request->staff_id);
        if ($request->filled('from')) $query->whereDate('earned_at', '>=', $request->from);
        if ($request->filled('to')) $query->whereDate('earned_at', '<=', $request->to);
        return response()->json(['data' => $query->paginate(min($request->integer('per_page', 25), 100))]);
    }

    public function summary(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);

        $monthStart = now('Asia/Manila')->startOfMonth();
        $monthEnd = $monthStart->copy()->addMonth();
        $leader = StaffCommission::query()
            ->with('staff:id,name')
            ->selectRaw('staff_id, SUM(commission_amount) as total_commission')
            ->where('earned_at', '>=', $monthStart)
            ->where('earned_at', '<', $monthEnd)
            ->groupBy('staff_id')
            ->orderByDesc('total_commission')
            ->first();

        return response()->json([
            'data' => [
                'amount' => (float) ($leader?->total_commission ?? 0),
                'staff_name' => $leader?->staff?->name,
            ],
        ]);
    }

    public function settings(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        return response()->json(['data' => CommissionSetting::with('staff:id,name,staff_type')->latest('created_at')->get()]);
    }

    public function saveSettings(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validated = $request->validate([
            'rate_percent' => 'required|numeric|min:0|max:100',
            'service_category' => 'nullable|string|max:40',
            'staff_id' => 'nullable|uuid|exists:users,id',
            'calculation_basis' => 'required|in:final_service_price',
            'is_active' => 'required|boolean',
            'effective_from' => 'nullable|date',
        ]);
        if (!empty($validated['staff_id']) && !User::find($validated['staff_id'])?->isGroomer()) return response()->json(['message' => 'Selected user is not an eligible Groomer.'], 422);
        $setting = CommissionSetting::create($validated + ['created_by' => $request->user()->id]);
        return response()->json(['data' => $setting->load('staff:id,name,staff_type')], 201);
    }

    public function availableAppointments(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validated = $request->validate(['staff_id' => 'required|uuid|exists:users,id']);
        $staff = User::findOrFail($validated['staff_id']);
        abort_unless($staff->isGroomer(), 422, 'Selected user is not an eligible Groomer.');
        $appointments = Appointment::with('service:id,name,category')
            ->where('status', 'completed')
            ->where('handled_by', $staff->id)
            ->whereDoesntHave('staffCommissions')
            ->latest('completed_at')
            ->limit(50)
            ->get(['id', 'appointment_code', 'service_id', 'total_price', 'completed_at']);
        $eligible = $appointments->map(function (Appointment $appointment) {
            $setting = $this->commissionService->resolveSetting($appointment);
            if (!$setting || (float) $setting->rate_percent <= 0) return null;

            $base = $this->commissionService->commissionBase($appointment);
            return array_merge($appointment->toArray(), [
                'commission_base_amount' => $base,
                'effective_rate_percent' => (float) $setting->rate_percent,
            ]);
        })->filter()->values();

        return response()->json(['data' => $eligible]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validated = $request->validate([
            'staff_id' => 'required|uuid|exists:users,id',
            'appointment_id' => 'required|uuid|exists:appointments,id',
            'rate_percent' => 'required|numeric|min:0|max:100',
            'service_amount' => 'nullable|numeric|min:0',
            'commission_amount' => 'nullable|numeric|min:0',
        ]);
        $staff = User::findOrFail($validated['staff_id']);
        abort_unless($staff->isGroomer(), 422, 'Selected user is not an eligible Groomer.');
        $appointment = Appointment::with('service')->where('status', 'completed')->where('handled_by', $staff->id)->findOrFail($validated['appointment_id']);
        if (StaffCommission::where('appointment_id', $appointment->id)->exists()) return response()->json(['message' => 'This appointment already has a commission record.'], 422);
        $base = (float) ($validated['service_amount'] ?? $appointment->total_price ?? 0);
        $rate = (float) $validated['rate_percent'];
        $commission = (float) ($validated['commission_amount'] ?? round($base * $rate / 100, 2));
        $record = StaffCommission::create([
            'staff_id' => $staff->id,
            'appointment_id' => $appointment->id,
            'service_id' => $appointment->service_id,
            'service_amount' => $base,
            'commission_base_amount' => $base,
            'rate_percent' => $rate,
            'commission_amount' => $commission,
            'calculation_basis' => 'manual_adjustment',
            'earned_at' => $appointment->completed_at ?: now('Asia/Manila'),
        ]);
        return response()->json(['data' => $record->load(['staff:id,name,staff_type', 'service:id,name,category', 'appointment:id,appointment_code,booking_source'])], 201);
    }

    public function update(Request $request, StaffCommission $staffCommission)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $validated = $request->validate([
            'rate_percent' => 'required|numeric|min:0|max:100',
            'service_amount' => 'required|numeric|min:0',
            'commission_amount' => 'nullable|numeric|min:0',
        ]);
        $base = (float) $validated['service_amount'];
        $rate = (float) $validated['rate_percent'];
        $staffCommission->update([
            'service_amount' => $base,
            'commission_base_amount' => $base,
            'rate_percent' => $rate,
            'commission_amount' => (float) ($validated['commission_amount'] ?? round($base * $rate / 100, 2)),
            'calculation_basis' => 'manual_adjustment',
        ]);
        return response()->json(['data' => $staffCommission->fresh()->load(['staff:id,name,staff_type', 'service:id,name,category', 'appointment:id,appointment_code,booking_source'])]);
    }
}
