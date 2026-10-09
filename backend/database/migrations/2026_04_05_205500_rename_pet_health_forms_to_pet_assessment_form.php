<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pet_health_forms') && !Schema::hasTable('pet_assessment_form')) {
            Schema::rename('pet_health_forms', 'pet_assessment_form');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('pet_assessment_form') && !Schema::hasTable('pet_health_forms')) {
            Schema::rename('pet_assessment_form', 'pet_health_forms');
        }
    }
};
