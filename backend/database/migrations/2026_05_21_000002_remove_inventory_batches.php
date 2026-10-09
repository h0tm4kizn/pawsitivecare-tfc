<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_batches')) {
            DB::table('inventory_batches')
                ->select('product_id', DB::raw('SUM(quantity_available) as total_quantity'))
                ->groupBy('product_id')
                ->orderBy('product_id')
                ->chunk(100, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('inventory')
                            ->where('id', $row->product_id)
                            ->update([
                                'stock_quantity' => (int) $row->total_quantity,
                                'is_active' => ((int) $row->total_quantity) > 0,
                                'updated_at' => now(),
                            ]);
                    }
                });
        }

        if (Schema::hasTable('supply_items')) {
            Schema::table('supply_items', function (Blueprint $table) {
                if (Schema::hasColumn('supply_items', 'batch_id')) {
                    $table->dropForeign(['batch_id']);
                    $table->dropColumn('batch_id');
                }
                if (Schema::hasColumn('supply_items', 'batch_quantity_used')) {
                    $table->dropColumn('batch_quantity_used');
                }
            });
        }

        Schema::dropIfExists('inventory_batches');
    }

    public function down(): void
    {
        // Batch tracking has been removed; rollback intentionally does not recreate it.
    }
};
