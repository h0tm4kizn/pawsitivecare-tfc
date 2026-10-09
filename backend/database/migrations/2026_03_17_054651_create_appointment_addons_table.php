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
Schema::create('appointment_addons', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('appointment_id')->constrained('appointments')->cascadeOnDelete();
    $table->foreignUuid('addon_id')->constrained('service_addons')->restrictOnDelete();
    $table->decimal('price_charged', 10, 2);
    $table->text('notes')->nullable();
    $table->timestamps();
});

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointment_addons');
    }
};
