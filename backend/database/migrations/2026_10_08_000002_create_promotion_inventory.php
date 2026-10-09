<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotion_inventory', function (Blueprint $table) {
            $table->uuid('promotion_id');
            $table->uuid('inventory_id');
            $table->primary(['promotion_id', 'inventory_id']);
            $table->foreign('promotion_id')->references('id')->on('promotions')->cascadeOnDelete();
            $table->foreign('inventory_id')->references('id')->on('inventory')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_inventory');
    }
};
