<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            // Grooming
            [
                'name' => 'Fresh me up',
                'category' => 'grooming',
                'description' => 'Relaxing bath & blow dry, signature shampoo, and pet safe cologne.',
                'aliases' => ['Fresh Me Up'],
            ],
            [
                'name' => 'Tidy up',
                'category' => 'grooming',
                'description' => 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, and pet safe cologne.',
                'aliases' => ['Tidy Up'],
            ],
            [
                'name' => 'Glow up',
                'category' => 'grooming',
                'description' => 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, sanitary trim, paw pad trim, fresh and cool shaved, summer cut fresh groom, and pet safe cologne.',
                'aliases' => ['Glow Up'],
            ],
            [
                'name' => 'Glam up',
                'category' => 'grooming',
                'description' => 'Relaxing bath & blow dry with signature shampoo, nail trim, ear cleaning with gentle hair removal, sanitary trim, fresh and cool shaved, summer cut fresh groom, styled haircut, paw balm treatment, organic fur serum for a silky finish, and pet safe cologne.',
                'aliases' => ['Glam Up'],
            ],
            [
                'name' => 'Pawsome Extras',
                'category' => 'grooming',
                'description' => 'Individual grooming services booked without a grooming package.',
                'aliases' => [],
            ],
            // Daycare
            [
                'name' => 'Daycare',
                'category' => 'daycare',
                'description' => 'Daycare hourly rates, Half Day Package (up to 4 hrs), and Full Day Package (up to 8 hrs). Requirements: Updated & Complete Vaccinations (with proof/Vet Record), Tick & Flea Prevention, Healthy & Free from Illness.',
                'aliases' => ['Daycare Playcare'],
            ],

            // Hotel
            [
                'name' => 'Pet Hotel Boarding',
                'category' => 'hotel',
                'description' => '-INCLUDES FULL DAYCARE & HOTEL STAY IN THEIR OWN SUITE - Air conditioned Suites, Daily room cleaning & Sanitation, 24/7 CCTV monitored, Supervised by our pet lover sitter, Regular feeding & fresh water, Playtime and Socialization, Cuddles & Human Interactions, Photo & Video Updates.',
            ],
        ];

        foreach ($rows as $row) {
            $aliases = $row['aliases'] ?? [];
            unset($row['aliases']);

            $service = Service::whereIn('name', array_merge([$row['name']], $aliases))->first();

            if (! $service) {
                $service = new Service();
            }

            $service->fill([
                'name'        => $row['name'],
                'category'    => $row['category'],
                'description' => $row['description'],
                'is_active'   => true,
            ])->save();
        }

        Service::where('category', 'grooming')
            ->whereNotIn('name', ['Fresh me up', 'Tidy up', 'Glow up', 'Glam up', 'Pawsome Extras'])
            ->delete();

        Service::whereNotIn('category', ['grooming', 'daycare', 'hotel'])
            ->update(['is_active' => false]);
    }
}
