<?php

namespace App\Console\Commands;

use App\Mail\PetBirthdayMail;
use App\Models\Notification;
use App\Models\Pet;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Mail;

class SendPetBirthdayNotifications extends Command
{
    protected $signature = 'pets:birthday-notifications';
    protected $description = 'Send pet birthday notifications and emails';

    public function handle(): int
    {
        $today = CarbonImmutable::now('Asia/Manila');

        $pets = Pet::with('owner.user')
            ->where(function ($query) use ($today) {
                $query->where(function ($todayQuery) use ($today) {
                    $todayQuery->whereMonth('date_of_birth', $today->month)
                        ->whereDay('date_of_birth', $today->day);
                });

                if (!$today->isLeapYear() && $today->month === 2 && $today->day === 28) {
                    $query->orWhere(function ($leapDayQuery) {
                        $leapDayQuery->whereMonth('date_of_birth', 2)
                            ->whereDay('date_of_birth', 29);
                    });
                }
            })
            ->whereNotNull('owner_id')
            ->where('is_active', true)
            ->get();

        foreach ($pets as $pet) {
            $owner = $pet->owner;
            if (!$owner || !$owner->is_active || ($owner->user && !$owner->user->is_active)) {
                continue;
            }

            $petName = $pet->name ?: 'your pet';
            $message = "It’s {$petName}’s birthday today! Wishing your furry friend a wonderful day filled with love and treats.";
            $dedupeKey = "pet-birthday:{$pet->id}:{$today->year}";

            try {
                $notification = Notification::firstOrCreate(
                    ['dedupe_key' => $dedupeKey],
                    [
                        'owner_id' => $owner->id,
                        'appointment_id' => null,
                        'subject' => "Happy Birthday, {$petName}!",
                        'message' => $message,
                        'type' => 'reminder',
                        'channel' => 'email',
                        'status' => 'sent',
                        'is_read' => false,
                        'sent_at' => $today,
                        'metadata' => [
                            'event' => 'pet_birthday',
                            'pet_id' => $pet->id,
                            'pet_name' => $petName,
                            'birthday_year' => $today->year,
                            'timezone' => 'Asia/Manila',
                        ],
                    ]
                );
            } catch (QueryException $exception) {
                // A concurrent scheduler run may have won the unique-key race.
                if (Notification::where('dedupe_key', $dedupeKey)->exists()) {
                    continue;
                }

                $this->warn("Birthday notification DB insert failed for {$owner->email}: {$exception->getMessage()}");
                continue;
            }

            // Only the first notification creation may send email.
            if ($notification->wasRecentlyCreated && $owner->email) {
                try {
                    Mail::to($owner->email)->send(new PetBirthdayMail($pet, $owner));
                    $this->info("Birthday notification sent for {$petName} -> {$owner->first_name} {$owner->last_name}");
                } catch (\Throwable $exception) {
                    // Keep the in-app notification even if mail delivery is unavailable.
                    $this->warn("Birthday email failed for {$owner->email}: {$exception->getMessage()}");
                }
            } elseif ($notification->wasRecentlyCreated) {
                $this->warn("Birthday in-app notification created for {$petName}; owner has no email address.");
            }
        }

        return self::SUCCESS;
    }
}
