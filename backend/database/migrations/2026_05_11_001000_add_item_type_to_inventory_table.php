<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('inventory')) {
            return;
        }

        Schema::table('inventory', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory', 'item_type')) {
                $table->string('item_type', 30)->default('product')->after('item_name');
            }
        });

        DB::table('inventory')
            ->where('category', 'service')
            ->update(['item_type' => 'service']);

        DB::table('inventory')
            ->where('category', 'retail')
            ->update(['item_type' => 'product']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('inventory') || ! Schema::hasColumn('inventory', 'item_type')) {
            return;
        }

        Schema::table('inventory', function (Blueprint $table) {
            $table->dropColumn('item_type');
        });
    }
};
