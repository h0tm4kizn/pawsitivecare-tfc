<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('item_id', 32)->unique(); // e.g. RET-0001 / SRV-0001
            $table->string('item_name', 150);
            $table->enum('category', ['retail', 'service']);
            $table->decimal('unit_price', 12, 2);
            $table->integer('stock_quantity')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['category', 'is_active']);
            $table->index('item_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('master_items');
    }
};

