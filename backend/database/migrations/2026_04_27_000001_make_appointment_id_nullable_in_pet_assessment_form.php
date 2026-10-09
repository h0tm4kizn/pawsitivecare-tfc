<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function tableName(): ?string
    {
        if (Schema::hasTable('pet_assessment_form')) {
            return 'pet_assessment_form';
        }

        if (Schema::hasTable('pet_health_forms')) {
            return 'pet_health_forms';
        }

        return null;
    }

    private function driver(): string
    {
        return DB::getDriverName();
    }

    public function up(): void
    {
        $table = $this->tableName();
        if (!$table || !Schema::hasColumn($table, 'appointment_id')) {
            return;
        }

        $driver = $this->driver();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE {$table} ALTER COLUMN appointment_id DROP NOT NULL");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE {$table} MODIFY appointment_id CHAR(36) NULL");
        }
    }

    public function down(): void
    {
        // Intentionally left empty. Existing rows may include NULL appointment_id values.
    }
};
