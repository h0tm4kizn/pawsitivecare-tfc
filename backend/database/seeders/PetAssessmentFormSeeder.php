<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\PetHealthForm;
use Illuminate\Database\Seeder;

class PetAssessmentFormSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        $appointments = Appointment::query()
            ->with(['pet'])
            ->orderByDesc('appointment_date')
            ->orderByDesc('start_time')
            ->limit(10)
            ->get();

        if ($appointments->isEmpty()) {
            return;
        }

        foreach ($appointments as $appointment) {
            if (!$appointment->pet_id) {
                continue;
            }

            $petWeight = $appointment->pet?->weight_kg;
            $weight = is_numeric($petWeight) ? (float) $petWeight : 5.00;

            PetHealthForm::updateOrCreate(
                ['appointment_id' => $appointment->id],
                [
                    'pet_id' => $appointment->pet_id,
                    'owner_id' => $appointment->booked_by_owner_id,
                    'service_id' => $appointment->service_id,
                    'is_vaccinated' => 'yes',
                    'vaccine_date' => now()->subMonths(2)->toDateString(),
                    'vaccine_5in1' => true,
                    'vaccine_rabies' => true,
                    'vaccine_records' => ['5-in-1', 'Rabies'],
                    'is_friendly' => 'yes',
                    'treat_preference' => 'both',
                    'allergies' => 'None',
                    'has_ticks' => false,
                    'has_flea' => false,
                    'has_wound' => false,
                    'has_mange' => false,
                    'has_bald_spot' => false,
                    'has_skin_problem' => false,
                    'has_lameness' => false,
                    'has_eye_discharge' => false,
                    'has_nasal_discharge' => false,
                    'has_ear_discharge' => false,
                    'medical_conditions' => 'None',
                    'declaration_accepted' => true,
                    'certified_at' => now(),
                    'weight_kg' => $weight,
                ]
            );
        }
    }
}

