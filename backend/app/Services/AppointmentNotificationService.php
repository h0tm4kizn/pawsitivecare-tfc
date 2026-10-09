<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Notification;

class AppointmentNotificationService
{
    public function create(
        Appointment $appointment,
        string $message,
        string $type = 'confirmation',
        string $subject = ''
    ): void {
        try {
            $loaded = $appointment->loadMissing(['pet.owner']);
            $owner = $loaded->pet?->owner;

            if (!$owner?->id) {
                return;
            }

            $exists = Notification::query()
                ->where('owner_id', $owner->id)
                ->where('appointment_id', $appointment->id)
                ->where('message', $message)
                ->exists();

            if ($exists) {
                return;
            }

            Notification::create([
                'owner_id' => $owner->id,
                'appointment_id' => $appointment->id,
                'subject' => $subject ?: null,
                'type' => $type,
                'channel' => 'email',
                'status' => 'sent',
                'message' => $message,
                'is_read' => false,
                'sent_at' => now('Asia/Manila'),
            ]);
        } catch (\Exception $e) {
            \Log::warning('Appointment notification creation failed: ' . $e->getMessage());
        }
    }
}
