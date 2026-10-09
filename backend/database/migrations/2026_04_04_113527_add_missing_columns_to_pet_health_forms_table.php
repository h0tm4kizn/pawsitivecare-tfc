<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pet_health_forms')) {
            return;
        }

        Schema::table('pet_health_forms', function (Blueprint $table) {
            $table->boolean('vaccine_rabies')->nullable()->after('vaccine_5in1');
            $table->boolean('has_ticks')->nullable()->after('vaccine_rabies');
            $table->boolean('has_flea')->nullable()->after('has_ticks');
            $table->boolean('has_wound')->nullable()->after('has_flea');
            $table->boolean('has_mange')->nullable()->after('has_wound');
            $table->boolean('has_bald_spot')->nullable()->after('has_mange');
            $table->boolean('has_skin_problem')->nullable()->after('has_bald_spot');
            $table->boolean('has_lameness')->nullable()->after('has_skin_problem');
            $table->boolean('has_eye_discharge')->nullable()->after('has_lameness');
            $table->boolean('has_nasal_discharge')->nullable()->after('has_eye_discharge');
            $table->boolean('has_ear_discharge')->nullable()->after('has_nasal_discharge');
            $table->string('medical_conditions')->nullable()->after('has_ear_discharge');
            $table->boolean('declaration_accepted')->nullable()->after('medical_conditions');
        });

        // Change is_vaccinated and is_friendly from boolean to string
        Schema::table('pet_health_forms', function (Blueprint $table) {
            $table->string('is_vaccinated', 10)->nullable()->change();
            $table->string('is_friendly', 10)->nullable()->change();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pet_health_forms')) {
            return;
        }

        Schema::table('pet_health_forms', function (Blueprint $table) {
            $table->dropColumn([
                'vaccine_rabies', 'has_ticks', 'has_flea', 'has_wound', 'has_mange',
                'has_bald_spot', 'has_skin_problem', 'has_lameness', 'has_eye_discharge',
                'has_nasal_discharge', 'has_ear_discharge', 'medical_conditions', 'declaration_accepted',
            ]);
            $table->boolean('is_vaccinated')->nullable()->change();
            $table->boolean('is_friendly')->nullable()->change();
        });
    }
};
