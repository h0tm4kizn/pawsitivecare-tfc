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
Schema::create('service_addons', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('name', 150);
    $table->enum('category', ['grooming_extra', 'treatment', 'daycare_upgrade']);
    $table->decimal('price_min', 10, 2);
    $table->decimal('price_max', 10, 2)->nullable();
    $table->boolean('has_size_pricing')->default(false);
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});


    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_addons');
    }
};
