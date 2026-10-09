<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        if (! Schema::hasTable('inventory')) {
            return;
        }

        DB::statement('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS master_items_category_check');
        DB::statement('ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_category_check');
    }

    public function down(): void
    {
        if (! Schema::hasTable('inventory')) {
            return;
        }

        DB::statement("ALTER TABLE inventory ADD CONSTRAINT inventory_category_check CHECK (category::text = ANY (ARRAY['retail'::text, 'service'::text]))");
    }
};
