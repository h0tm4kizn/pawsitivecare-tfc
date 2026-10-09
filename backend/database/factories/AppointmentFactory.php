<?php

namespace Database\Factories;

use App\Models\Appointment;
use App\Models\Pet;
use App\Models\Service;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Appointment>
 */
class AppointmentFactory extends Factory
{
    protected $model = Appointment::class;

    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        $service = Service::first() ?? Service::factory()->create();
        $pet = Pet::factory();

        return [
            'appointment_code' => 'DC' . date('y') . str_pad($this->faker->unique()->numberBetween(1, 999), 3, '0', STR_PAD_LEFT),
            'pet_id' => $pet,
            'service_id' => $service->id,
            'booked_by_owner_id' => fn() => $pet->owner_id ?? $pet->owner()->first()->id,
            'status' => 'pending',
            'appointment_date' => $this->faker->dateTimeBetween('+1 day', '+30 days')->format('Y-m-d'),
            'start_time' => $this->faker->time('H:i:s'),
            'total_price' => $this->faker->randomFloat(2, 500, 5000),
            'notes' => $this->faker->sentence(),
        ];
    }
}
