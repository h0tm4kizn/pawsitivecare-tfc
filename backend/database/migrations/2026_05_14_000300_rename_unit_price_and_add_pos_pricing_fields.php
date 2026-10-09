<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory')) {
            Schema::table('inventory', function (Blueprint $table) {
                if (Schema::hasColumn('inventory', 'unit_price') && ! Schema::hasColumn('inventory', 'selling_price')) {
                    $table->renameColumn('unit_price', 'selling_price');
                }
            });

            Schema::table('inventory', function (Blueprint $table) {
                if (! Schema::hasColumn('inventory', 'barcode')) {
                    $table->string('barcode')->nullable()->unique()->after('item_id');
                }

                if (! Schema::hasColumn('inventory', 'cost_price')) {
                    $table->decimal('cost_price', 12, 2)->default(80.00)->after('category');
                }
            });
        }

        if (Schema::hasTable('walk_in_sale_items')) {
            Schema::table('walk_in_sale_items', function (Blueprint $table) {
                if (Schema::hasColumn('walk_in_sale_items', 'unit_price') && ! Schema::hasColumn('walk_in_sale_items', 'selling_price')) {
                    $table->renameColumn('unit_price', 'selling_price');
                }
            });

            Schema::table('walk_in_sale_items', function (Blueprint $table) {
                if (! Schema::hasColumn('walk_in_sale_items', 'cost_price_snapshot')) {
                    $table->decimal('cost_price_snapshot', 12, 2)->nullable()->after('item_snapshot_name');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('walk_in_sale_items')) {
            Schema::table('walk_in_sale_items', function (Blueprint $table) {
                if (Schema::hasColumn('walk_in_sale_items', 'cost_price_snapshot')) {
                    $table->dropColumn('cost_price_snapshot');
                }
            });

            Schema::table('walk_in_sale_items', function (Blueprint $table) {
                if (Schema::hasColumn('walk_in_sale_items', 'selling_price') && ! Schema::hasColumn('walk_in_sale_items', 'unit_price')) {
                    $table->renameColumn('selling_price', 'unit_price');
                }
            });
        }

        if (Schema::hasTable('inventory')) {
            Schema::table('inventory', function (Blueprint $table) {
                if (Schema::hasColumn('inventory', 'cost_price')) {
                    $table->dropColumn('cost_price');
                }
            });

            Schema::table('inventory', function (Blueprint $table) {
                if (Schema::hasColumn('inventory', 'barcode')) {
                    $table->dropUnique(['barcode']);
                    $table->dropColumn('barcode');
                }
            });

            Schema::table('inventory', function (Blueprint $table) {
                if (Schema::hasColumn('inventory', 'selling_price') && ! Schema::hasColumn('inventory', 'unit_price')) {
                    $table->renameColumn('selling_price', 'unit_price');
                }
            });
        }
    }
};
