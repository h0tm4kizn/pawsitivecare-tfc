<?php

namespace Database\Seeders;

use App\Models\HotelSuite;
use Illuminate\Database\Seeder;

class HotelSuiteSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            // --- Dog Suites ---
            [
                'name'            => 'The Cozy Paw Suite',
                'species_type'    => 'dog',
                'size_range'      => 'XS to Small',
                'price_per_night' => 650.00,
                'capacity'        => 6,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
            [
                'name'            => 'The Happy Paws Suite',
                'species_type'    => 'dog',
                'size_range'      => 'XS to Medium',
                'price_per_night' => 750.00,
                'capacity'        => 6,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
            [
                'name'            => 'The Grand Paw Suite',
                'species_type'    => 'dog',
                'size_range'      => 'XS to Large',
                'price_per_night' => 950.00,
                'capacity'        => 3,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
            [
                'name'            => 'The VIPaws Suite',
                'species_type'    => 'dog',
                'size_range'      => 'XS to XLarge',
                'price_per_night' => 1050.00,
                'capacity'        => 3,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],

            // --- Cat Suites ---
            [
                'name'            => 'The Cozy Whiskers',
                'species_type'    => 'cat',
                'size_range'      => 'All Sizes',
                'price_per_night' => 550.00,
                'capacity'        => 6,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
            [
                'name'            => 'The Grand Purr Suite',
                'species_type'    => 'cat',
                'size_range'      => 'All Sizes',
                'price_per_night' => 650.00,
                'capacity'        => 6,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
            [
                'name'            => 'The VIPurr Villa',
                'species_type'    => 'cat',
                'size_range'      => 'All Sizes',
                'price_per_night' => 750.00,
                'capacity'        => 3,
                'is_available'    => true,
                'description'     => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
        ];

        foreach ($rows as $row) {
            $suite = HotelSuite::firstOrCreate(
                ['name' => $row['name']],
                $row
            );

            $suite->fill([
                'species_type'    => $row['species_type'],
                'size_range'      => $row['size_range'],
                'price_per_night' => $row['price_per_night'],
                'capacity'        => $row['capacity'],
                'is_available'    => $row['is_available'],
                'description'     => $row['description'],
            ])->save();
        }
    }
}
