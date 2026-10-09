<?php

namespace App\Support;

final class CustomerAppointmentFormatter
{
    public static function statusLabel(?string $status): string
    {
        return match (strtolower(str_replace('-', '_', trim((string) $status)))) {
            'pending' => 'Pending',
            'approved' => 'Approved',
            'in_progress', 'checkin', 'checked_in' => 'In Progress',
            'completed' => 'Completed',
            'cancelled', 'canceled' => 'Cancelled',
            'no_show' => 'No Show',
            'rejected' => 'Rejected',
            default => 'Appointment update',
        };
    }

    public static function reason(?string $reason): ?string
    {
        $raw = trim((string) $reason);
        if ($raw === '') {
            return null;
        }

        $normalized = strtolower($raw);
        if (str_contains($normalized, '[late cancellation]')
            || str_contains($normalized, 'grace period')
            || str_contains($normalized, 'no-show')) {
            return 'The appointment was cancelled after the 15-minute grace period had elapsed.';
        }

        $clean = preg_replace('/^\s*\[(?:late cancellation|rejected)\]\s*/i', '', $raw);
        $clean = preg_replace('/^\s*(?:client-initiated|administrative cancellation|policy violation)\s*:\s*/i', '', (string) $clean);
        $clean = preg_replace('/\s*\([^)]*policy violation[^)]*\)\s*/i', ' ', (string) $clean);
        $clean = preg_replace('/\s+/', ' ', (string) $clean);
        $clean = trim((string) $clean, " \t\n\r\0\x0B-:;" );

        return $clean !== '' ? $clean : null;
    }

    public static function notificationMessage(?string $message): string
    {
        $raw = trim((string) $message);
        if ($raw === '') return '';

        $marker = stripos($raw, ' Reason:');
        if ($marker === false) return $raw;

        $prefix = rtrim(substr($raw, 0, $marker));
        $reason = self::reason(substr($raw, $marker + 8));
        return $reason ? $prefix . ' Reason: ' . $reason : $prefix;
    }
}
