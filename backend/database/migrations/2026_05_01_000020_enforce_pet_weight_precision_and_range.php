<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        // Ensure pet weight supports up to 4 integer digits and 2 decimals (e.g. 10.00, 9999.99).
        DB::statement('ALTER TABLE pets ALTER COLUMN weight_kg TYPE numeric(6,2) USING (CASE WHEN weight_kg IS NULL THEN NULL ELSE ROUND(weight_kg::numeric, 2) END)');
        DB::statement('ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_weight_kg_range_check');
        DB::statement('ALTER TABLE pets ADD CONSTRAINT pets_weight_kg_range_check CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 9999.99))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_weight_kg_range_check');
        DB::statement('ALTER TABLE pets ALTER COLUMN weight_kg TYPE numeric(8,2) USING (CASE WHEN weight_kg IS NULL THEN NULL ELSE ROUND(weight_kg::numeric, 2) END)');
    }
};
