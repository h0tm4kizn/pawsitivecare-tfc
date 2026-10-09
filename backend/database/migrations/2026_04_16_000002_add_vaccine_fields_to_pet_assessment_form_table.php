<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pet_assessment_form')) {
            return;
        }

        Schema::table('pet_assessment_form', function (Blueprint $table) {
            if (!Schema::hasColumn('pet_assessment_form', 'vaccine_date')) {
                $table->date('vaccine_date')->nullable()->after('is_vaccinated');
            }

            if (!Schema::hasColumn('pet_assessment_form', 'vaccines')) {
                $table->json('vaccines')->nullable()->after('vaccine_date');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pet_assessment_form')) {
            return;
        }

        Schema::table('pet_assessment_form', function (Blueprint $table) {
            if (Schema::hasColumn('pet_assessment_form', 'vaccines')) {
                $table->dropColumn('vaccines');
            }

            if (Schema::hasColumn('pet_assessment_form', 'vaccine_date')) {
                $table->dropColumn('vaccine_date');
            }
        });
    }
};
