<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Owner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Owner>
 */
class OwnerFactory extends Factory
{
    protected $model = Owner::class;

    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        return [
            'display_id' => 'CX' . date('y') . str_pad($this->faker->unique()->numberBetween(1, 999), 3, '0', STR_PAD_LEFT),
            'user_id' => User::factory(),
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'email' => $this->faker->safeEmail(),
            'phone' => $this->faker->phoneNumber(),
            'address' => $this->faker->address(),
            'address_unit_floor' => $this->faker->numberBetween(1, 20),
            'address_street' => $this->faker->streetName(),
            'address_barangay' => 'Barangay ' . $this->faker->word(),
            'address_city' => 'Manila',
            'address_province' => 'Metro Manila',
            'address_postal_code' => $this->faker->postcode(),
            'address_country' => 'Philippines',
            'preferred_contact' => 'phone',
            'is_active' => true,
        ];
    }
}
