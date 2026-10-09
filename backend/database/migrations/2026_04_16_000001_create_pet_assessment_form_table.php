<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pet_assessment_form')) {
            return;
        }

        Schema::create('pet_assessment_form', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('pet_id')->constrained('pets')->cascadeOnDelete();
            $table->foreignUuid('owner_id')->nullable()->constrained('owners')->nullOnDelete();
            $table->foreignUuid('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();

            $table->string('is_vaccinated', 10)->nullable();
            $table->boolean('vaccine_5in1')->nullable();
            $table->boolean('vaccine_rabies')->nullable();
            $table->string('is_friendly', 10)->nullable();

            $table->boolean('has_ticks')->nullable();
            $table->boolean('has_flea')->nullable();
            $table->boolean('has_wound')->nullable();
            $table->boolean('has_mange')->nullable();
            $table->boolean('has_bald_spot')->nullable();
            $table->boolean('has_skin_problem')->nullable();
            $table->boolean('has_lameness')->nullable();
            $table->boolean('has_eye_discharge')->nullable();
            $table->boolean('has_nasal_discharge')->nullable();
            $table->boolean('has_ear_discharge')->nullable();

            $table->string('medical_conditions')->nullable();
            $table->boolean('declaration_accepted')->nullable();
            $table->timestamp('certified_at')->nullable();

            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pet_assessment_form');
    }
};
