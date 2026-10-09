<?php

namespace Database\Factories;

use App\Models\Pet;
use App\Models\Owner;
use App\Models\SpeciesType;
use App\Models\Breed;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Pet>
 */
class PetFactory extends Factory
{
    protected $model = Pet::class;

    /**
     * Define the model's default state.
     */
    public function definition(): array
    {
        $species = SpeciesType::firstOrCreate(
            ['name' => 'Dog'],
            ['code' => 'DOG']
        );

        $breed = Breed::firstOrCreate(
            ['name' => 'Labrador Retriever', 'species_id' => $species->id],
            ['code' => 'LAB']
        );

        return [
            'pet_id' => 'D' . date('y') . str_pad($this->faker->unique()->numberBetween(1, 999), 3, '0', STR_PAD_LEFT),
            'owner_id' => Owner::factory(),
            'species_id' => $species->id,
            'breed_id' => $breed->id,
            'name' => $this->faker->firstName(),
            'sex' => $this->faker->randomElement(['Male', 'Female']),
            'date_of_birth' => $this->faker->dateTimeBetween('-10 years', '-1 year'),
            'weight_kg' => $this->faker->randomFloat(2, 5, 50),
            'is_active' => true,
        ];
    }
}
