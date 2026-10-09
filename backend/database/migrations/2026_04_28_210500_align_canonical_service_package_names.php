<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        $now = now();

        $canonical = [
            // Daycare
            ['display_id' => 'DCPKG2601', 'name' => 'Daycare Playcare', 'category' => 'daycare', 'description' => 'Supervised daytime socialization, play, and feeding.'],

            // Grooming
            ['display_id' => 'GPKG2601', 'name' => 'Fresh Me Up', 'category' => 'grooming', 'description' => 'Full bath, blow dry, nail trim, ear cleaning, and light trim.'],
            ['display_id' => 'GPKG2602', 'name' => 'Tidy Up', 'category' => 'grooming', 'description' => 'Bath, blow dry, and basic hygiene tidy-up.'],
            ['display_id' => 'GPKG2603', 'name' => 'Glow Up', 'category' => 'grooming', 'description' => 'Bath, blow dry, full haircut and styling for a fresh look.'],
            ['display_id' => 'GPKG2604', 'name' => 'Glam Up', 'category' => 'grooming', 'description' => 'Premium full groom with creative styling and finishing touches.'],
            ['display_id' => 'GPKG2605', 'name' => 'Dematting', 'category' => 'grooming', 'description' => 'Careful removal of mats and tangles with minimal discomfort.'],
            ['display_id' => 'GPKG2606', 'name' => 'Bath & Blow Dry', 'category' => 'grooming', 'description' => 'Basic bath and professional blow dry only.'],
            ['display_id' => 'GPKG2607', 'name' => 'Medicated Bath', 'category' => 'grooming', 'description' => 'Medicated shampoo treatment for skin conditions and infections.'],
            ['display_id' => 'GPKG2608', 'name' => 'Organic Bath', 'category' => 'grooming', 'description' => 'Gentle organic shampoo bath for sensitive skin.'],
            ['display_id' => 'GPKG2609', 'name' => 'Whitening Bath', 'category' => 'grooming', 'description' => 'Whitening shampoo treatment to brighten coat color.'],

            // Hotel
            ['display_id' => 'HPKG2601', 'name' => 'The Cozy Paw Suite', 'category' => 'hotel', 'description' => 'Overnight monitored care in The Cozy Paw Suite.'],
            ['display_id' => 'HPKG2602', 'name' => 'The Happy Paws Suite', 'category' => 'hotel', 'description' => 'Overnight monitored care in The Happy Paws Suite.'],
            ['display_id' => 'HPKG2603', 'name' => 'The Grand Paw Suite', 'category' => 'hotel', 'description' => 'Overnight monitored care in The Grand Paw Suite.'],
            ['display_id' => 'HPKG2604', 'name' => 'The VIPaws Suite', 'category' => 'hotel', 'description' => 'Overnight monitored care in The VIPaws Suite.'],
            ['display_id' => 'HPKG2605', 'name' => 'The Cozy Whiskers', 'category' => 'hotel', 'description' => 'Overnight monitored care in The Cozy Whiskers suite.'],
            ['display_id' => 'HPKG2606', 'name' => 'The Grand Purr Suite', 'category' => 'hotel', 'description' => 'Overnight monitored care in The Grand Purr Suite.'],
            ['display_id' => 'HPKG2607', 'name' => 'The VIPurr Villa', 'category' => 'hotel', 'description' => 'Overnight monitored care in The VIPurr Villa.'],
        ];

        foreach ($canonical as $row) {
            $byCode = DB::table('services')->where('display_id', $row['display_id'])->first();
            if ($byCode) {
                DB::table('services')
                    ->where('id', $byCode->id)
                    ->update([
                        'name' => $row['name'],
                        'category' => $row['category'],
                        'description' => $row['description'],
                        'is_active' => true,
                        'updated_at' => $now,
                    ]);
                continue;
            }

            $byName = DB::table('services')
                ->whereRaw('lower(name) = ?', [Str::lower($row['name'])])
                ->whereRaw('lower(category) = ?', [Str::lower($row['category'])])
                ->orderBy('created_at')
                ->orderBy('id')
                ->first();

            if ($byName) {
                DB::table('services')
                    ->where('id', $byName->id)
                    ->update([
                        'display_id' => $row['display_id'],
                        'name' => $row['name'],
                        'category' => $row['category'],
                        'description' => $row['description'],
                        'is_active' => true,
                        'updated_at' => $now,
                    ]);
                continue;
            }

            DB::table('services')->insert([
                'id' => (string) Str::uuid(),
                'display_id' => $row['display_id'],
                'name' => $row['name'],
                'category' => $row['category'],
                'description' => $row['description'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Keep appointment transaction IDs aligned with the finalized package display_id.
        DB::statement("
            WITH ranked AS (
                SELECT
                    a.id,
                    s.display_id AS base_display_id,
                    row_number() OVER (
                        PARTITION BY a.service_id
                        ORDER BY a.created_at, a.id
                    ) AS seq
                FROM appointments a
                JOIN services s ON s.id = a.service_id
                WHERE s.display_id ~ '^(GPKG|HPKG|DCPKG)[0-9]{4}$'
            )
            UPDATE appointments a
            SET appointment_code = ranked.base_display_id || '-' || ranked.seq::text
            FROM ranked
            WHERE a.id = ranked.id
        ");
    }

    public function down(): void
    {
        // Intentionally no destructive rollback for canonical data alignment.
    }
};
