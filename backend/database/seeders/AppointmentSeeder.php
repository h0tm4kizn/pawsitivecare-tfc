<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\HotelSuite;
use App\Models\Pet;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Seeder;

class AppointmentSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        $pets = Pet::query()
            ->whereNotNull('owner_id')
            ->with(['owner', 'speciesType'])
            ->get();

        if ($pets->isEmpty()) {
            return;
        }

        $dogPet = $pets->first(fn ($pet) => strtoupper((string) ($pet->speciesType?->code ?? '')) === 'D') ?? $pets->first();
        $catPet = $pets->first(fn ($pet) => strtoupper((string) ($pet->speciesType?->code ?? '')) === 'C') ?? $pets->first();
        $hotelPet = $dogPet ?? $catPet;

        $grooming = Service::query()->where('category', 'grooming')->first();
        $daycare = Service::query()->where('category', 'daycare')->first();
        $hotel = Service::query()->where('category', 'hotel')->first();

        $suiteDog = HotelSuite::query()->where('species_type', 'dog')->first() ?? HotelSuite::query()->first();
        $suiteCat = HotelSuite::query()->where('species_type', 'cat')->first() ?? HotelSuite::query()->first();

        $groomer = User::query()->where('role', 'staff')->where('staff_type', 'groomer')->first();
        $fallbackStaff = User::query()->where('role', 'staff')->first();
        $handledById = $groomer?->id ?? $fallbackStaff?->id;

        $rows = array_values(array_filter([
            // Grooming: in progress today
            [
                'pet_id' => $dogPet?->id,
                'service_id' => $grooming?->id,
                'hotel_suite_id' => null,
                'handled_by' => $handledById,
                'booked_by_owner_id' => $dogPet?->owner_id,
                'size_label' => 'M',
                'status' => 'in_progress',
                'appointment_date' => now()->toDateString(),
                'start_time' => '09:00:00',
                'check_in_time' => now()->setTime(9, 0),
                'check_out_time' => null,
                'completed_at' => null,
                'total_price' => 350.00,
                'deposit' => null,
                'reference_number' => null,
                'notes' => 'Seeded in-progress grooming appointment.',
            ],
            // Daycare: approved upcoming
            [
                'pet_id' => $catPet?->id,
                'service_id' => $daycare?->id,
                'hotel_suite_id' => null,
                'handled_by' => $handledById,
                'booked_by_owner_id' => $catPet?->owner_id,
                'size_label' => 'half_day_small',
                'status' => 'approved',
                'appointment_date' => now()->addDay()->toDateString(),
                'start_time' => '10:00:00',
                'check_in_time' => null,
                'check_out_time' => null,
                'completed_at' => null,
                'daycare_duration' => 'half_day',
                'is_full_day_package' => false,
                'total_price' => 500.00,
                'deposit' => null,
                'reference_number' => null,
                'notes' => 'Seeded upcoming daycare appointment.',
            ],
            // Hotel: pending with reservation deposit reference
            [
                'pet_id' => $hotelPet?->id,
                'service_id' => $hotel?->id,
                'hotel_suite_id' => (strtoupper((string) ($hotelPet?->speciesType?->code ?? '')) === 'C' ? $suiteCat?->id : $suiteDog?->id),
                'handled_by' => $handledById,
                'booked_by_owner_id' => $hotelPet?->owner_id,
                'size_label' => strtoupper((string) ($hotelPet?->speciesType?->code ?? '')) === 'C' ? ($suiteCat?->name ?? 'Cat Suite') : ($suiteDog?->name ?? 'Dog Suite'),
                'status' => 'pending',
                'appointment_date' => now()->addDays(2)->toDateString(),
                'start_time' => '14:00:00',
                'hotel_nights' => 2,
                'check_in_time' => null,
                'check_out_time' => null,
                'completed_at' => null,
                'total_price' => 1300.00,
                'deposit' => 650.00,
                'reference_number' => 'HOTEL-SEED-2201',
                'notes' => 'Seeded pending hotel booking with reservation deposit reference.',
            ],
            // Grooming: completed
            [
                'pet_id' => $catPet?->id,
                'service_id' => $grooming?->id,
                'hotel_suite_id' => null,
                'handled_by' => $handledById,
                'booked_by_owner_id' => $catPet?->owner_id,
                'size_label' => 'CAT',
                'status' => 'completed',
                'appointment_date' => now()->subDays(2)->toDateString(),
                'start_time' => '13:00:00',
                'check_in_time' => now()->subDays(2)->setTime(13, 0),
                'check_out_time' => now()->subDays(2)->setTime(15, 0),
                'completed_at' => now()->subDays(2)->setTime(15, 0),
                'total_price' => 750.00,
                'deposit' => null,
                'reference_number' => null,
                'notes' => 'Seeded completed grooming appointment.',
            ],
        ], fn ($row) => !empty($row['service_id']) && !empty($row['pet_id']) && !empty($row['booked_by_owner_id'])));

        foreach ($rows as $row) {
            $unique = [
                'pet_id' => $row['pet_id'],
                'service_id' => $row['service_id'],
                'appointment_date' => $row['appointment_date'],
                'start_time' => $row['start_time'],
            ];

            if (!empty($row['hotel_suite_id'])) {
                $unique['hotel_suite_id'] = $row['hotel_suite_id'];
            }

            Appointment::updateOrCreate($unique, [
                'hotel_suite_id' => $row['hotel_suite_id'],
                'handled_by' => $row['handled_by'],
                'booked_by_owner_id' => $row['booked_by_owner_id'],
                'size_label' => $row['size_label'],
                'status' => $row['status'],
                'appointment_date' => $row['appointment_date'],
                'start_time' => $row['start_time'],
                'check_in_time' => $row['check_in_time'] ?? null,
                'check_out_time' => $row['check_out_time'] ?? null,
                'completed_at' => $row['completed_at'] ?? null,
                'special_instructions' => $row['special_instructions'] ?? null,
                'daycare_duration' => $row['daycare_duration'] ?? null,
                'hotel_nights' => $row['hotel_nights'] ?? null,
                'is_full_day_package' => $row['is_full_day_package'] ?? false,
                'grooming_discount' => $row['grooming_discount'] ?? null,
                'total_price' => $row['total_price'],
                'deposit' => $row['deposit'] ?? null,
                'reference_number' => $row['reference_number'] ?? null,
                'notes' => $row['notes'] ?? null,
                'cancellation_reason' => $row['cancellation_reason'] ?? null,
            ]);
        }
    }
}
