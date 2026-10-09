<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pet_assessment_form', function (Blueprint $table) {
            if (!Schema::hasColumn('pet_assessment_form', 'vaccine_records')) {
                // Stores per-vaccine dates as JSON: { "Rabies (Mandatory)": "2025-01-15", ... }
                $table->json('vaccine_records')->nullable()->after('vaccines');
            }
            if (!Schema::hasColumn('pet_assessment_form', 'weight_kg')) {
                // Snapshot of pet weight at time of assessment
                $table->decimal('weight_kg', 6, 2)->nullable()->after('vaccine_records');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pet_assessment_form', function (Blueprint $table) {
            foreach (['vaccine_records', 'weight_kg'] as $col) {
                if (Schema::hasColumn('pet_assessment_form', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
