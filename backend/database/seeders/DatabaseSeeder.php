<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // Dev/test users only. Skip entirely in production.
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $this->call([
            AdminSeeder::class,
            StaffSeeder::class,
            SpeciesTypeSeeder::class,
            BreedSeeder::class,
            ServiceSeeder::class,
            ServiceTierSeeder::class,
            HotelSuiteSeeder::class,
            ServiceAddonSeeder::class,
            InventorySeeder::class,
            ShopHourSeeder::class,
            ShopHoursSettingSeeder::class,
        ]);

        // Optional local-only customer/owner seed data.
        // Keep disabled by default so Supabase/shared environments do not get demo owners.
        if ((bool) env('SEED_CUSTOMERS', false)) {
            $this->call([
                CustomerSeeder::class,
            ]);
        }
    }
}
