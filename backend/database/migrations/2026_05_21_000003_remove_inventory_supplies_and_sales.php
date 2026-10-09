<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            foreach (['service_materials', 'supply_items', 'supplies', 'walk_in_sale_items', 'walk_in_sales', 'inventory_batches', 'billing_ledger', 'billing_ledgers', 'inventory'] as $table) {
                Schema::dropIfExists($table);
            }
            return;
        }
        // Handle both legacy table name variants before dropping inventory.
        foreach (['billing_ledger', 'billing_ledgers'] as $billingTable) {
            if (!Schema::hasTable($billingTable)) {
                continue;
            }

            // Drop known FK constraints that may still point to inventory/master_items.
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("ALTER TABLE {$billingTable} DROP CONSTRAINT IF EXISTS {$billingTable}_inventory_id_foreign");
                DB::statement("ALTER TABLE {$billingTable} DROP CONSTRAINT IF EXISTS {$billingTable}_master_item_id_foreign");
            }

            if (Schema::hasColumn($billingTable, 'inventory_id')) {
                Schema::table($billingTable, function (Blueprint $table) {
                    $table->dropColumn('inventory_id');
                });
            }

            if (Schema::hasColumn($billingTable, 'master_item_id')) {
                Schema::table($billingTable, function (Blueprint $table) {
                    $table->dropColumn('master_item_id');
                });
            }
        }

        if (Schema::hasTable('service_addons') && Schema::hasColumn('service_addons', 'inventory_item_id')) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_inventory_item_id_foreign');
            }
            Schema::table('service_addons', function (Blueprint $table) {
                $table->dropColumn('inventory_item_id');
            });
        }

        Schema::dropIfExists('service_materials');
        Schema::dropIfExists('supply_items');
        Schema::dropIfExists('supplies');
        Schema::dropIfExists('walk_in_sale_items');
        Schema::dropIfExists('walk_in_sales');
        Schema::dropIfExists('inventory_batches');
        Schema::dropIfExists('billing_ledger');
        Schema::dropIfExists('billing_ledgers');
        Schema::dropIfExists('inventory');
    }

    public function down(): void
    {
        // Inventory, supply, and retail sale data has been intentionally removed.
        // Recreate these tables from the older migrations if the module is restored.
    }
};
