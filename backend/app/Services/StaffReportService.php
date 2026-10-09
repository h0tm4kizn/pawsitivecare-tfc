<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Service;
use App\Models\StaffAttendance;
use App\Models\StaffCommission;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

class StaffReportService
{
    public const TIMEZONE = 'Asia/Manila';

    public function __construct(private readonly StaffAttendanceService $attendanceService)
    {
    }

    public function range(array $filters): array
    {
        $year = (int) $filters['year'];
        $month = (int) ($filters['month'] ?? 1);
        $monthly = $filters['view'] === 'monthly';
        $periodStart = Carbon::create($year, $monthly ? $month : 1, 1, 0, 0, 0, self::TIMEZONE);
        $periodEnd = $monthly ? $periodStart->copy()->endOfMonth()->endOfDay() : Carbon::create($year, 12, 31, 23, 59, 59, self::TIMEZONE);
        $start = !empty($filters['from'])
            ? Carbon::parse($filters['from'], self::TIMEZONE)->startOfDay()
            : $periodStart;
        $end = !empty($filters['to'])
            ? Carbon::parse($filters['to'], self::TIMEZONE)->endOfDay()
            : $periodEnd;
        return [$start, $end];
    }

    public function activity(array $filters): array
    {
        [$start, $end] = $this->range($filters);
        $counts = Appointment::query()
            ->selectRaw("handled_by, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show")
            ->whereNotNull('handled_by')
            ->whereBetween('appointment_date', [$start->toDateString(), $end->toDateString()]);
        if (!empty($filters['appointment_status'])) {
            $filters['appointment_status'] === 'in_progress'
                ? $counts->whereIn('status', ['in_progress', 'checkin', 'checked_in'])
                : $counts->where('status', $filters['appointment_status']);
        }
        $counts->groupBy('handled_by');
        $staff = User::query()->where('users.role', 'staff')
            ->leftJoinSub($counts, 'activity', 'activity.handled_by', '=', 'users.id')
            ->selectRaw('users.id, users.display_id, users.name, users.email, users.staff_type, COALESCE(activity.total, 0) as total, COALESCE(activity.completed, 0) as completed, COALESCE(activity.cancelled, 0) as cancelled, COALESCE(activity.no_show, 0) as no_show');
        if (!empty($filters['staff_id'])) $staff->where('users.id', $filters['staff_id']);
        if (!empty($filters['staff_type'])) $staff->where('users.staff_type', $filters['staff_type']);
        $rows = $staff->orderBy('users.name')->get()->map(fn ($row) => [
            'user_id' => $row->id,
            'display_id' => $row->display_id,
            'name' => $row->name,
            'email' => $row->email,
            'staff_type' => $row->staff_type,
            'total' => (int) $row->total,
            'completed' => (int) $row->completed,
            'cancelled' => (int) $row->cancelled,
            'no_show' => (int) $row->no_show,
        ])->all();
        return ['by_staff' => $rows, 'summary' => [
            'staff_count' => count($rows),
            'assigned' => array_sum(array_column($rows, 'total')),
            'completed' => array_sum(array_column($rows, 'completed')),
            'cancelled' => array_sum(array_column($rows, 'cancelled')),
            'no_show' => array_sum(array_column($rows, 'no_show')),
        ]];
    }

    public function activityDetails(array $filters): LengthAwarePaginator
    {
        [$start, $end] = $this->range($filters);
        $query = Appointment::query()
            ->with(['service:id,name', 'pet:id,name'])
            ->whereNotNull('handled_by')
            ->whereBetween('appointment_date', [$start->toDateString(), $end->toDateString()]);
        if (!empty($filters['staff_id'])) $query->where('handled_by', $filters['staff_id']);
        if (!empty($filters['staff_type'])) $query->whereHas('handledBy', fn ($staff) => $staff->where('staff_type', $filters['staff_type']));
        if (!empty($filters['appointment_status'])) {
            $filters['appointment_status'] === 'in_progress'
                ? $query->whereIn('status', ['in_progress', 'checkin', 'checked_in'])
                : $query->where('status', $filters['appointment_status']);
        }
        return $query->orderByDesc('appointment_date')->orderByDesc('id')
            ->paginate(min((int) ($filters['per_page'] ?? 50), 1000))
            ->through(fn ($row) => [
                'id' => $row->id,
                'appointment_code' => $row->appointment_code,
                'date' => $row->appointment_date?->toDateString(),
                'service' => $row->service?->name,
                'pet' => $row->pet?->name,
                'status' => $row->status,
            ]);
    }

    public function attendanceQuery(array $filters)
    {
        [$start, $end] = $this->range($filters);
        $query = StaffAttendance::query()
            ->join('users as staff_user', 'staff_user.id', '=', 'staff_attendance.staff_id')
            ->leftJoin('users as recorder_user', 'recorder_user.id', '=', 'staff_attendance.recorded_by')
            ->select('staff_attendance.*', 'staff_user.display_id as staff_display_id', 'staff_user.name as staff_name', 'staff_user.staff_type as staff_type', 'recorder_user.name as recorded_by_name')
            ->whereBetween('staff_attendance.time_in_at', [$start->copy()->setTimezone(config('app.timezone')), $end->copy()->setTimezone(config('app.timezone'))])
            ->orderByDesc('staff_attendance.time_in_at')
            ->orderByDesc('staff_attendance.id');
        if (!empty($filters['staff_id'])) $query->where('staff_attendance.staff_id', $filters['staff_id']);
        if (!empty($filters['staff_type'])) $query->where('staff_user.staff_type', $filters['staff_type']);
        return $query;
    }

    public function attendanceRows(array $filters): \Generator
    {
        foreach ($this->attendanceQuery($filters)->cursor() as $record) {
            $state = $this->attendanceService->describe($record);
            if (!empty($filters['status']) && $state['status'] !== $filters['status']) continue;
            $in = $record->time_in_at?->copy()->setTimezone(self::TIMEZONE);
            $out = $record->time_out_at?->copy()->setTimezone(self::TIMEZONE);
            yield [
                'id' => $record->id,
                'date' => $in?->toDateString(),
                'staff_id' => $record->staff_id,
                'staff_display_id' => $record->staff_display_id,
                'staff_name' => $record->staff_name,
                'staff_type' => $record->staff_type,
                'recorded_by' => $record->recorded_by,
                'recorded_by_name' => $record->recorded_by_name,
                'recording_method' => $record->recording_method,
                'time_in' => $in?->toIso8601String(),
                'time_out' => $out?->toIso8601String(),
                'duration_seconds' => $in && $out ? max(0, (int) $in->diffInSeconds($out)) : null,
                'status' => $state['status'],
                'status_label' => $state['status'] === 'completed' ? 'Completed Shift' : $state['label'],
                'needs_review' => $state['needs_review'],
            ];
        }
    }

    public function attendance(array $filters): array
    {
        $perPage = min((int) ($filters['per_page'] ?? 100), 1000);
        $page = max(1, LengthAwarePaginator::resolveCurrentPage());
        $offset = ($page - 1) * $perPage;
        $rows = [];
        $days = [];
        $summary = ['count' => 0, 'on_duty' => 0, 'needs_review' => 0, 'completed' => 0, 'days_worked' => 0, 'total_seconds' => 0];
        foreach ($this->attendanceRows($filters) as $row) {
            $index = $summary['count']++;
            $days[$row['staff_id'] . ':' . $row['date']] = true;
            if ($row['status'] === 'on_duty') $summary['on_duty']++;
            if ($row['status'] === 'missing_time_out') $summary['needs_review']++;
            if ($row['status'] === 'completed') {
                $summary['completed']++;
                $summary['total_seconds'] += $row['duration_seconds'];
            }
            if ($index >= $offset && count($rows) < $perPage) $rows[] = $row;
        }
        $summary['days_worked'] = count($days);
        [$start, $end] = $this->range($filters);
        return [
            'data' => new LengthAwarePaginator($rows, $summary['count'], $perPage, $page, ['path' => request()->url(), 'query' => request()->query()]),
            'summary' => $summary,
            'range' => ['from' => $start->toDateString(), 'to' => $end->toDateString(), 'timezone' => self::TIMEZONE],
        ];
    }

    public function commissionQuery(array $filters)
    {
        [$start, $end] = $this->range($filters);
        $query = StaffCommission::query()
            ->with(['staff:id,display_id,name,staff_type', 'service' => fn ($service) => $service->withTrashed()->select('id', 'name', 'category'), 'appointment:id,appointment_code,pet_id,booked_by_owner_id,service_id', 'appointment.pet:id,name,pet_id', 'appointment.bookedByOwner:id,first_name,last_name,display_id'])
            ->whereBetween('earned_at', [$start->copy()->setTimezone(config('app.timezone')), $end->copy()->setTimezone(config('app.timezone'))])
            ->orderByDesc('earned_at')->orderByDesc('id');
        if (!empty($filters['staff_id'])) $query->where('staff_id', $filters['staff_id']);
        if (!empty($filters['staff_type'])) $query->whereHas('staff', fn ($staff) => $staff->where('staff_type', $filters['staff_type']));
        if (!empty($filters['service_id'])) $query->where('service_id', $filters['service_id']);
        return $query;
    }

    public function commissions(array $filters): array
    {
        $query = $this->commissionQuery($filters);
        $summary = (clone $query)->reorder()->selectRaw('COUNT(*) as count, COALESCE(SUM(commission_amount), 0) as total_commission, COALESCE(SUM(commission_base_amount), 0) as total_base, AVG(rate_percent) as average_rate')->first();
        [$start, $end] = $this->range($filters);
        return [
            'data' => $query->paginate(min((int) ($filters['per_page'] ?? 100), 1000)),
            'summary' => [
                'count' => (int) $summary->count,
                'total_commission' => round((float) $summary->total_commission, 2),
                'total_base' => round((float) $summary->total_base, 2),
                'average_rate' => round((float) ($summary->average_rate ?? 0), 2),
            ],
            'range' => ['from' => $start->toDateString(), 'to' => $end->toDateString(), 'timezone' => self::TIMEZONE],
        ];
    }

    public function options(): array
    {
        return [
            'staff' => User::query()->where('role', 'staff')->orderBy('name')->get(['id', 'display_id', 'name', 'staff_type']),
            'services' => Service::query()->withTrashed()->orderBy('name')->get(['id', 'name']),
        ];
    }
}
