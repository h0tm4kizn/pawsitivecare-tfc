<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('inventory')) {
            return;
        }

        // Inventory uses substring ILIKE for interactive catalog search. These
        // are the fields searched by the UI; category is intentionally omitted
        // because it is a low-cardinality filter and already has a B-tree index.
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_inventory_item_id_trgm ON inventory USING gin (item_id gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_inventory_barcode_trgm ON inventory USING gin (barcode gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_inventory_item_name_trgm ON inventory USING gin (item_name gin_trgm_ops)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS idx_inventory_item_id_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_inventory_barcode_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_inventory_item_name_trgm');
    }
};
