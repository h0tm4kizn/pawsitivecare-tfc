<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        if (Schema::hasTable('owners')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_owners_first_name_trgm ON owners USING gin (first_name gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_owners_last_name_trgm ON owners USING gin (last_name gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_owners_email_trgm ON owners USING gin (email gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_owners_phone_trgm ON owners USING gin (phone gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_owners_display_id_trgm ON owners USING gin (display_id gin_trgm_ops)');
        }

        if (Schema::hasTable('pets')) {
            DB::statement('CREATE INDEX IF NOT EXISTS idx_pets_name_trgm ON pets USING gin (name gin_trgm_ops)');
            if (Schema::hasColumn('pets', 'pet_id')) {
                DB::statement('CREATE INDEX IF NOT EXISTS idx_pets_pet_id_trgm ON pets USING gin (pet_id gin_trgm_ops)');
            } elseif (Schema::hasColumn('pets', 'pet_code')) {
                DB::statement('CREATE INDEX IF NOT EXISTS idx_pets_pet_code_trgm ON pets USING gin (pet_code gin_trgm_ops)');
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS idx_owners_first_name_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_owners_last_name_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_owners_email_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_owners_phone_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_owners_display_id_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_pets_name_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_pets_pet_id_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_pets_pet_code_trgm');
    }
};
