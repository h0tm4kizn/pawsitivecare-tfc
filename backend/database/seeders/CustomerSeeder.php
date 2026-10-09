<?php

namespace Database\Seeders;

use App\Models\Owner;
use App\Models\Pet;
use App\Models\User;
use App\Models\SpeciesType;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        $existingUser = User::where('email', 'demo.owner@example.invalid')->first();

        if ($existingUser && !$existingUser->email_verified_at) {
            $existingUser->forceFill(['email_verified_at' => now('Asia/Manila')])->save();
        }

        // Create owner profile
        $owner = Owner::updateOrCreate(
            ['email' => 'demo.owner@example.invalid'],
            [
                'user_id'       => $existingUser?->id,
                'first_name'    => 'Demo',
                'last_name'     => 'Owner',
                'phone'         => null,
                'ec_first_name' => 'Emergency',
                'ec_last_name'  => 'Contact',
                'ec_email'      => 'emergency@example.invalid',
                'ec_phone'      => null,
            ]
        );

        // Create test pets
        $dog = SpeciesType::where('code', 'D')->first();
        $cat = SpeciesType::where('code', 'C')->first();

        if ($dog) {
            $dogBreed = \App\Models\Breed::where('species_id', $dog->id)->first();
            if ($dogBreed) {
                Pet::updateOrCreate(
                    ['owner_id' => $owner->id, 'name' => 'Buddy'],
                    [
                        'sex'           => 'male',
                        'date_of_birth' => now()->subYears(3)->toDateString(),
                        'species_id'    => $dog->id,
                        'breed_id'      => $dogBreed->id,
                    ]
                );
            }
        }

        if ($cat) {
            $catBreed = \App\Models\Breed::where('species_id', $cat->id)->first();
            if ($catBreed) {
                Pet::updateOrCreate(
                    ['owner_id' => $owner->id, 'name' => 'Whiskers'],
                    [
                        'sex'           => 'female',
                        'date_of_birth' => now()->subYears(2)->toDateString(),
                        'species_id'    => $cat->id,
                        'breed_id'      => $catBreed->id,
                    ]
                );
            }
        }
    }
}
