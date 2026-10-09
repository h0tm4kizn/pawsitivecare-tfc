<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop old constraint and add new one with hotel_grooming
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_category_check");
            DB::statement("ALTER TABLE service_addons ADD CONSTRAINT service_addons_category_check CHECK (category IN ('grooming_extra','treatment','daycare_upgrade','hotel_grooming'))");
        }
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        // Seed hotel grooming addons
        $hasServiceId = Schema::hasColumn('service_addons', 'service_id');
        $hotelServiceId = $hasServiceId
            ? DB::table('services')->where('category', 'hotel')->value('id')
            : null;

        $addons = [
            ['name' => 'Dematting',       'price_min' => 200, 'price_max' => 500],
            ['name' => 'Bath & Blow Dry', 'price_min' => 250, 'price_max' => 850],
            ['name' => 'Medicated Bath',  'price_min' => 150, 'price_max' => 350],
            ['name' => 'Organic Bath',    'price_min' => 250, 'price_max' => 350],
            ['name' => 'Whitening Bath',  'price_min' => 250, 'price_max' => 350],
        ];

        foreach ($addons as $a) {
            $payload = [
                'id'               => \Illuminate\Support\Str::uuid(),
                'name'             => $a['name'],
                'category'         => 'hotel_grooming',
                'price_min'        => $a['price_min'],
                'price_max'        => $a['price_max'],
                'has_size_pricing' => false,
                'is_active'        => true,
                'created_at'       => now(),
                'updated_at'       => now(),
            ];

            if ($hasServiceId) {
                $payload['service_id'] = $hotelServiceId;
            }

            DB::table('service_addons')->insert($payload);
        }
    }

    public function down(): void
    {
        DB::table('service_addons')->where('category', 'hotel_grooming')->delete();
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_category_check");
            DB::statement("ALTER TABLE service_addons ADD CONSTRAINT service_addons_category_check CHECK (category IN ('grooming_extra','treatment','daycare_upgrade'))");
        }
    }
};
