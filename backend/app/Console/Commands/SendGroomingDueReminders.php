<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\GroomingDueMail;
use Carbon\Carbon;

class SendGroomingDueReminders extends Command
{
    protected $signature   = 'pets:grooming-due-reminders';
    protected $description = 'Send grooming due reminder emails to owners whose pet has not had a grooming in 2 months';

    public function handle()
    {
        $twoMonthsAgo    = Carbon::now('Asia/Manila')->subMonths(2)->toDateString();
        $twoMonthsAndOne = Carbon::now('Asia/Manila')->subMonths(2)->subDay()->toDateString();

        // Find pets whose last completed grooming was exactly 2 months ago
        // and have no completed grooming booked after that date
        $pets = DB::table('appointments as a')
            ->join('pets as p', 'p.id', '=', 'a.pet_id')
            ->join('owners as o', 'o.id', '=', 'p.owner_id')
            ->join('services as s', 's.id', '=', 'a.service_id')
            ->whereDate('a.appointment_date', $twoMonthsAgo)
            ->where('a.status', 'completed')
            ->where('s.category', 'grooming')
            ->whereNotNull('o.email')
            ->whereNotExists(function ($query) use ($twoMonthsAgo) {
                // No newer completed or upcoming grooming exists
                $query->from('appointments as a2')
                    ->join('services as s2', 's2.id', '=', 'a2.service_id')
                    ->whereColumn('a2.pet_id', 'a.pet_id')
                    ->where('s2.category', 'grooming')
                    ->whereIn('a2.status', ['completed', 'approved', 'pending', 'in_progress'])
                    ->whereDate('a2.appointment_date', '>', $twoMonthsAgo);
            })
            ->select(
                'p.id as pet_id', 'p.name as pet_name', 'p.pet_id as pet_identifier',
                'o.id as owner_id', 'o.first_name', 'o.last_name', 'o.full_name', 'o.email',
                'a.appointment_date as last_grooming_date'
            )
            ->get();

        $sent = 0;

        foreach ($pets as $row) {
            // Skip if we already sent this reminder for this pet this month
            $alreadySent = DB::table('notifications')
                ->where('owner_id', $row->owner_id)
                ->where('type', 'grooming_due')
                ->whereRaw("message LIKE ?", ["%{$row->pet_name}%"])
                ->whereMonth('sent_at', Carbon::now('Asia/Manila')->month)
                ->whereYear('sent_at', Carbon::now('Asia/Manila')->year)
                ->exists();

            if ($alreadySent) continue;

            $pet = (object) [
                'id'   => $row->pet_id,
                'name' => $row->pet_name,
            ];

            $owner = (object) [
                'id'         => $row->owner_id,
                'full_name'  => $row->full_name ?? trim("{$row->first_name} {$row->last_name}"),
                'first_name' => $row->first_name,
                'last_name'  => $row->last_name,
                'email'      => $row->email,
            ];

            try {
                Mail::to($owner->email)->send(new GroomingDueMail($pet, $owner, $row->last_grooming_date));

                DB::table('notifications')->insert([
                    'id'             => \Illuminate\Support\Str::uuid(),
                    'owner_id'       => $owner->id,
                    'appointment_id' => null,
                    'subject'        => 'Grooming Due Reminder',
                    'message'        => "It's been 2 months since {$pet->name}'s last grooming. Time to book a new session!",
                    'type'           => 'grooming_due',
                    'channel'        => 'email',
                    'status'         => 'sent',
                    'is_read'        => false,
                    'sent_at'        => now('Asia/Manila'),
                    'created_at'     => now('Asia/Manila'),
                    'updated_at'     => now('Asia/Manila'),
                ]);

                $this->info("Grooming due reminder sent to {$owner->email} for {$pet->name}.");
                $sent++;
            } catch (\Exception $e) {
                $this->warn("Failed for {$owner->email}: {$e->getMessage()}");
            }
        }

        $this->info("Done. {$sent} grooming due reminder(s) sent.");

        return Command::SUCCESS;
    }
}
