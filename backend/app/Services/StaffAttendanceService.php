<?php

namespace App\Services;

use App\Models\ShopHoursSetting;
use App\Models\StaffAttendance;
use App\Models\User;
use Illuminate\Support\Carbon;

class StaffAttendanceService
{
    public const MISSING_TIME_OUT_GRACE_MINUTES = 60;
    public const TIMEZONE = 'Asia/Manila';

    /**
     * Attendance is the source of truth for assignment eligibility.
     * Missing-time-out records are deliberately not considered on duty.
     */
    public function isCurrentlyOnDuty(User $staff, ?Carbon $now = null): bool
    {
        if (!$staff->is_active || !$staff->isStaff()) {
            return false;
        }

        $attendance = StaffAttendance::query()
            ->where('staff_id', $staff->id)
            ->whereNotNull('time_in_at')
            ->whereNull('time_out_at')
            ->latest('time_in_at')
            ->first();

        return $attendance !== null
            && $this->describe($attendance, $now)['status'] === 'on_duty';
    }

    public function describe(?StaffAttendance $attendance, ?Carbon $now = null): array
    {
        if (!$attendance || !$attendance->time_in_at) {
            return ['status' => 'off_duty', 'label' => 'Off duty', 'needs_review' => false, 'expected_closing_at' => null];
        }

        if ($attendance->time_out_at) {
            return ['status' => 'completed', 'label' => 'Off duty', 'needs_review' => false, 'expected_closing_at' => null];
        }

        $now = ($now ?: now(self::TIMEZONE))->copy()->setTimezone(self::TIMEZONE);
        $timeIn = $attendance->time_in_at->copy()->setTimezone(self::TIMEZONE);
        $closing = $this->closingAt($timeIn);
        $reviewBoundary = $closing?->copy()->addMinutes(self::MISSING_TIME_OUT_GRACE_MINUTES);
        $needsReview = $reviewBoundary && $now->greaterThan($reviewBoundary);

        return [
            'status' => $needsReview ? 'missing_time_out' : 'on_duty',
            'label' => $needsReview ? 'Missing Time Out' : 'On duty',
            'needs_review' => (bool) $needsReview,
            'expected_closing_at' => $closing?->toIso8601String(),
        ];
    }

    public function closingAt(Carbon $date): ?Carbon
    {
        $day = strtolower($date->format('D'));
        $raw = ShopHoursSetting::get('shop_hours_raw', [])[$day] ?? null;
        if (is_array($raw)) {
            if (($raw['closed'] ?? false) || empty($raw['close'])) return null;
            return $this->atTime($date, (string) $raw['close']);
        }

        $formatted = ShopHoursSetting::get('shop_hours', [])[$day] ?? null;
        if (!$formatted || strtolower(trim((string) $formatted)) === 'closed') return null;
        if (!preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', (string) $formatted, $matches)) return null;
        return $this->atTime($date, $matches[3] . ' ' . $matches[4]);
    }

    private function atTime(Carbon $date, string $time): ?Carbon
    {
        try {
            $format = str_contains(strtoupper($time), 'AM') || str_contains(strtoupper($time), 'PM') ? 'g:i A' : 'H:i';
            return Carbon::createFromFormat($format, strtoupper(trim($time)), self::TIMEZONE)
                ->setDate($date->year, $date->month, $date->day);
        } catch (\Throwable) {
            return null;
        }
    }
}
