<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('master_items') && ! Schema::hasTable('inventory')) {
            Schema::rename('master_items', 'inventory');
        }

        if (Schema::hasTable('billing_ledger') && Schema::hasColumn('billing_ledger', 'master_item_id')) {
            Schema::table('billing_ledger', function (Blueprint $table) {
                $table->renameColumn('master_item_id', 'inventory_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('billing_ledger') && Schema::hasColumn('billing_ledger', 'inventory_id')) {
            Schema::table('billing_ledger', function (Blueprint $table) {
                $table->renameColumn('inventory_id', 'master_item_id');
            });
        }

        if (Schema::hasTable('inventory') && ! Schema::hasTable('master_items')) {
            Schema::rename('inventory', 'master_items');
        }
    }
};
