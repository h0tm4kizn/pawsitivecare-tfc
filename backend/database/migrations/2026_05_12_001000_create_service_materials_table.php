<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_materials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('service_id')->constrained('services')->cascadeOnDelete();
            $table->foreignUuid('inventory_id')->constrained('inventory')->cascadeOnDelete();
            $table->unsignedInteger('quantity_per_service')->default(1);
            $table->timestamps();

            $table->unique(['service_id', 'inventory_id']);
            $table->index('service_id');
            $table->index('inventory_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_materials');
    }
};
