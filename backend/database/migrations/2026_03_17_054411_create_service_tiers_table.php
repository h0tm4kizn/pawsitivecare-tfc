<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
Schema::create('service_tiers', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('service_id')->constrained('services')->cascadeOnDelete();
    $table->string('size_label', 20);
    $table->decimal('price', 10, 2);
    $table->decimal('price_max', 10, 2)->nullable();
    $table->decimal('duration_hours', 4, 1)->nullable();
    $table->timestamps();
});


    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_tiers');
    }
};
