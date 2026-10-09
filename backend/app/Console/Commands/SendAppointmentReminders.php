<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Notification;
use App\Mail\AppointmentReminderMail;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;

class SendAppointmentReminders extends Command
{
    protected $signature   = 'appointments:send-reminders';
    protected $description = 'Send 24-hour reminder emails and notifications for tomorrow\'s approved appointments';

    public function handle()
    {
        $tomorrow = now()->timezone('Asia/Manila')->addDay()->toDateString();

        $appointments = Appointment::with(['pet.owner', 'service', 'hotelSuite'])
            ->whereDate('appointment_date', $tomorrow)
            ->where('status', 'approved')
            ->get();

        $sent = 0;

        foreach ($appointments as $appointment) {
            $owner = $appointment->pet?->owner;

            if (!$owner || !$owner->email) continue;

            $petName = $appointment->pet->name ?? 'your pet';
            $dateLabel = Carbon::parse($appointment->appointment_date)->format('F j, Y');
            $message = "Reminder: Appointment booking for {$petName} is scheduled for tomorrow, {$dateLabel}.";

            // Skip if notification already sent for this appointment
            $alreadySent = Notification::where('owner_id', $owner->id)
                ->where('appointment_id', $appointment->id)
                ->where('type', 'reminder')
                ->exists();

            if (!$alreadySent) {
                try {
                    Notification::create([
                        'owner_id'       => $owner->id,
                        'appointment_id' => $appointment->id,
                        'subject'        => 'Appointment Tomorrow',
                        'message'        => $message,
                        'type'           => 'reminder',
                        'channel'        => 'email',
                        'status'         => 'sent',
                        'is_read'        => false,
                        'sent_at'        => now(),
                    ]);
                } catch (\Exception $e) {
                    $this->warn("Notification DB insert failed for {$owner->email}: {$e->getMessage()}");
                }
            }

            try {
                Mail::to($owner->email)->send(
                    new AppointmentReminderMail($appointment, $owner, $appointment->pet)
                );
                $this->info("Reminder sent to {$owner->email} for {$petName}");
                $sent++;
            } catch (\Exception $e) {
                $this->warn("Email failed for {$owner->email}: {$e->getMessage()}");
            }
        }

        $this->info("Done. {$sent} reminder(s) sent.");

        return Command::SUCCESS;
    }
}
