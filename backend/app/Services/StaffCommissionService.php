<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\CommissionSetting;
use App\Models\StaffCommission;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StaffCommissionService
{
    public function earnForCompletedAppointment(Appointment $appointment): ?StaffCommission
    {
        if ($appointment->status !== 'completed' || !$appointment->handled_by) return null;

        $handler = User::query()->find($appointment->handled_by);
        if (!$handler || !$handler->isGroomer()) return null;

        return DB::transaction(function () use ($appointment) {
            $appointment = Appointment::query()->with('service')->lockForUpdate()->findOrFail($appointment->id);
            $existing = StaffCommission::query()->where('appointment_id', $appointment->id)->first();
            if ($existing) return $existing;

            $setting = $this->resolveSetting($appointment);

            if (!$setting || (float) $setting->rate_percent <= 0) return null;

            $base = $this->commissionBase($appointment);
            $rate = (float) $setting->rate_percent;

            return StaffCommission::create([
                'staff_id' => $appointment->handled_by,
                'appointment_id' => $appointment->id,
                'service_id' => $appointment->service_id,
                'service_amount' => $base,
                'commission_base_amount' => $base,
                'rate_percent' => $rate,
                'commission_amount' => round($base * $rate / 100, 2),
                'calculation_basis' => $setting->calculation_basis ?: 'final_service_price',
                'earned_at' => $appointment->completed_at ?: now('Asia/Manila'),
            ]);
        });
    }

    public function resolveSetting(Appointment $appointment): ?CommissionSetting
    {
        $appointment->loadMissing('service');
        $category = strtolower((string) ($appointment->service?->category ?? '')) ?: null;
        $date = optional($appointment->completed_at)->toDateString() ?: now('Asia/Manila')->toDateString();

        return CommissionSetting::query()
            ->where('is_active', true)
            ->where(function ($query) use ($appointment) {
                $query->where('staff_id', $appointment->handled_by)->orWhereNull('staff_id');
            })
            ->where(function ($query) use ($category) {
                $query->where('service_category', $category)->orWhereNull('service_category');
            })
            ->where(function ($query) use ($date) {
                $query->whereNull('effective_from')->orWhereDate('effective_from', '<=', $date);
            })
            ->orderByRaw('CASE WHEN staff_id IS NULL THEN 1 ELSE 0 END')
            ->orderByRaw('CASE WHEN service_category IS NULL THEN 1 ELSE 0 END')
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->first();
    }

    public function commissionBase(Appointment $appointment): float
    {
        return max(0, (float) ($appointment->total_price ?? 0));
    }
}
