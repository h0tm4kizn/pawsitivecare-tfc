<?php

namespace Database\Seeders;

use App\Models\SpeciesType;
use Illuminate\Database\Seeder;

class SpeciesTypeSeeder extends Seeder
{
    /**
     * Seed only Cat and Dog as the default v2.0 baseline species.
     */
    public function run(): void
    {
        $rows = [
            ['name' => 'Dog', 'code' => 'D'],
            ['name' => 'Cat', 'code' => 'C'],
        ];

        foreach ($rows as $row) {
            SpeciesType::updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'is_active' => true]
            );
        }
    }
}
