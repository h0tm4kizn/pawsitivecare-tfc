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
            if (!Schema::hasColumn('pet_assessment_form', 'vet_clinic_name')) {
                $table->string('vet_clinic_name', 150)->nullable()->after('vaccine_date');
            }

            if (!Schema::hasColumn('pet_assessment_form', 'vet_contact_number')) {
                $table->string('vet_contact_number', 30)->nullable()->after('vet_clinic_name');
            }

            if (!Schema::hasColumn('pet_assessment_form', 'treat_preference')) {
                $table->string('treat_preference', 20)->nullable()->after('is_friendly');
            }

            if (!Schema::hasColumn('pet_assessment_form', 'allergies')) {
                $table->text('allergies')->nullable()->after('treat_preference');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pet_assessment_form')) {
            return;
        }

        Schema::table('pet_assessment_form', function (Blueprint $table) {
            foreach (['allergies', 'treat_preference', 'vet_contact_number', 'vet_clinic_name'] as $col) {
                if (Schema::hasColumn('pet_assessment_form', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
