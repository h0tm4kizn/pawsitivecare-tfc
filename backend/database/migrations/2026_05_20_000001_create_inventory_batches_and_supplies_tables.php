<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('walk_in_sale_id')->nullable()->constrained('walk_in_sales')->nullOnDelete();
            $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('appointment_id');
            $table->index('created_by');
        });

        Schema::create('supply_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('supply_id')->constrained('supplies')->cascadeOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained('inventory')->nullOnDelete();
            $table->string('product_name', 150);
            $table->unsignedInteger('quantity_used')->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index('supply_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supply_items');
        Schema::dropIfExists('supplies');
    }
};
