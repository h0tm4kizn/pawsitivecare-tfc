<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS inventory_batches_product_id_expiration_date_index');
        DB::statement('DROP INDEX IF EXISTS supply_items_expiration_date_index');

        if (Schema::hasTable('inventory_batches') && Schema::hasColumn('inventory_batches', 'expiration_date')) {
            Schema::table('inventory_batches', function (Blueprint $table) {
                $table->dropColumn('expiration_date');
            });
        }

        if (Schema::hasTable('supply_items') && Schema::hasColumn('supply_items', 'expiration_date')) {
            Schema::table('supply_items', function (Blueprint $table) {
                $table->dropColumn('expiration_date');
            });
        }
    }

    public function down(): void
    {
        // Expiration tracking has been removed from inventory and sales.
    }
};
