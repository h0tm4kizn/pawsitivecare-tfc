<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $products = DB::table('inventory')
            ->where('item_type', 'product')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id']);

        foreach ($products as $index => $product) {
            DB::table('inventory')
                ->where('id', $product->id)
                ->update(['item_id' => 'TMP-ITEM-' . str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT)]);
        }

        foreach ($products as $index => $product) {
            DB::table('inventory')
                ->where('id', $product->id)
                ->update(['item_id' => 'ITEM-' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)]);
        }

    }

    public function down(): void
    {
        // Historical item codes should not be reconstructed after normalization.
    }
};
