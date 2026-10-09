<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->uuid('promotion_id')->nullable()->after('service_id');
            $table->string('promotion_title_snapshot', 150)->nullable();
            $table->string('promotion_type_snapshot', 30)->nullable();
            $table->decimal('promotion_value_snapshot', 10, 2)->nullable();
            $table->decimal('promotion_original_price', 10, 2)->nullable();
            $table->decimal('promotion_discount_amount', 10, 2)->nullable();
            $table->decimal('promotion_final_price', 10, 2)->nullable();
            $table->foreign('promotion_id')->references('id')->on('promotions')->nullOnDelete();
        });

        Schema::table('walk_in_sale_items', function (Blueprint $table) {
            $table->uuid('promotion_id')->nullable()->after('inventory_id');
            $table->string('promotion_title_snapshot', 150)->nullable();
            $table->string('promotion_type_snapshot', 30)->nullable();
            $table->decimal('promotion_value_snapshot', 10, 2)->nullable();
            $table->decimal('original_unit_price', 10, 2)->nullable();
            $table->decimal('discount_amount', 10, 2)->nullable();
            $table->decimal('final_unit_price', 10, 2)->nullable();
            $table->foreign('promotion_id')->references('id')->on('promotions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_sale_items', function (Blueprint $table) {
            $table->dropForeign(['promotion_id']);
            $table->dropColumn([
                'promotion_id', 'promotion_title_snapshot', 'promotion_type_snapshot',
                'promotion_value_snapshot', 'original_unit_price', 'discount_amount',
                'final_unit_price',
            ]);
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['promotion_id']);
            $table->dropColumn([
                'promotion_id', 'promotion_title_snapshot', 'promotion_type_snapshot',
                'promotion_value_snapshot', 'promotion_original_price',
                'promotion_discount_amount', 'promotion_final_price',
            ]);
        });
    }
};
