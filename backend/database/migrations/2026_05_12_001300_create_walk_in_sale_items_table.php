<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('walk_in_sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('walk_in_sale_id')->constrained('walk_in_sales')->cascadeOnDelete();
            $table->foreignUuid('inventory_id')->nullable()->constrained('inventory')->nullOnDelete();
            $table->string('item_snapshot_id', 32)->nullable();
            $table->string('item_snapshot_name', 150);
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('subtotal', 12, 2);

            $table->index('walk_in_sale_id');
            $table->index('inventory_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('walk_in_sale_items');
    }
};
