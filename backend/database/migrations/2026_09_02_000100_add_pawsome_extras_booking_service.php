<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $service = DB::table('services')
            ->whereRaw('LOWER(name) = ?', ['pawsome extras'])
            ->first();

        if ($service) {
            $serviceUpdates = [
                'name' => 'Pawsome Extras',
                'category' => 'grooming',
                'description' => 'Individual grooming services booked without a grooming package.',
                'is_active' => true,
                'updated_at' => $now,
            ];
            if (Schema::hasColumn('services', 'deleted_at')) {
                $serviceUpdates['deleted_at'] = null;
            }
            DB::table('services')->where('id', $service->id)->update($serviceUpdates);
            $serviceId = $service->id;
        } else {
            $serviceId = (string) Str::uuid();
            DB::table('services')->insert([
                'id' => $serviceId,
                'name' => 'Pawsome Extras',
                'category' => 'grooming',
                'description' => 'Individual grooming services booked without a grooming package.',
                'is_active' => true,
                'needs_cage' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $tier = DB::table('service_tiers')
            ->where('service_id', $serviceId)
            ->where('size_label', 'Standard')
            ->first();
        $tierValues = [
            'price' => 0,
            'price_max' => null,
            'duration_hours' => 1,
            'updated_at' => $now,
        ];
        if ($tier) {
            DB::table('service_tiers')->where('id', $tier->id)->update($tierValues);
        } else {
            DB::table('service_tiers')->insert(array_merge($tierValues, [
                'id' => (string) Str::uuid(),
                'service_id' => $serviceId,
                'size_label' => 'Standard',
                'created_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        $service = DB::table('services')
            ->whereRaw('LOWER(name) = ?', ['pawsome extras'])
            ->first();

        if (! $service || DB::table('appointments')->where('service_id', $service->id)->exists()) {
            return;
        }

        DB::table('service_tiers')->where('service_id', $service->id)->delete();
        DB::table('services')->where('id', $service->id)->delete();
    }
};
