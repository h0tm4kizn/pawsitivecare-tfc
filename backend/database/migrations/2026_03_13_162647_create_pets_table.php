<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Updated pets table migration to match actual Supabase schema
     */
    public function up(): void
    {
        Schema::create('pets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('pet_id', 255)->nullable();
            $table->uuid('owner_id');
            $table->uuid('species_id');
            $table->uuid('breed_id');
            $table->string('name', 100);
            $table->string('sex', 255)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->decimal('weight_kg')->nullable();
            $table->text('biometric_hash')->nullable();
            $table->text('biometric_image_url')->nullable();
            $table->text('medical_notes')->nullable();
            $table->text('photo_url')->nullable();
            $table->timestamp('created_at')->useCurrent();
            // Note: no updated_at in actual schema
            
            // Foreign key constraints
            $table->foreign('owner_id')->references('id')->on('owners')->onDelete('cascade');
            $table->foreign('species_id')->references('id')->on('species_types');
            $table->foreign('breed_id')->references('id')->on('breeds');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pets');
    }
};
