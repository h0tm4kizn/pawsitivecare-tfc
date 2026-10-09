<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contact_messages')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read_created_at ON contact_messages (is_read, created_at)');
        }

        if (Schema::hasTable('pet_assessment_form')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_assessment_form_pet_created_at ON pet_assessment_form (pet_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_assessment_form_pet_appointment_created_at ON pet_assessment_form (pet_id, appointment_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_assessment_form_pet_service_created_at ON pet_assessment_form (pet_id, service_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_assessment_form_pet_owner_created_at ON pet_assessment_form (pet_id, owner_id, created_at)');
        }

        if (Schema::hasTable('pet_health_forms')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_health_forms_pet_created_at ON pet_health_forms (pet_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_health_forms_pet_appointment_created_at ON pet_health_forms (pet_id, appointment_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_health_forms_pet_service_created_at ON pet_health_forms (pet_id, service_id, created_at)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pet_health_forms_pet_owner_created_at ON pet_health_forms (pet_id, owner_id, created_at)');
        }

        if (Schema::hasTable('service_addons')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_service_addons_category_active ON service_addons (category, is_active)');
        }
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_contact_messages_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_contact_messages_is_read_created_at');

        DB::statement('DROP INDEX IF EXISTS idx_pet_assessment_form_pet_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_assessment_form_pet_appointment_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_assessment_form_pet_service_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_assessment_form_pet_owner_created_at');

        DB::statement('DROP INDEX IF EXISTS idx_pet_health_forms_pet_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_health_forms_pet_appointment_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_health_forms_pet_service_created_at');
        DB::statement('DROP INDEX IF EXISTS idx_pet_health_forms_pet_owner_created_at');

        DB::statement('DROP INDEX IF EXISTS idx_service_addons_category_active');
    }
};

