<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function resolveTableName(): ?string
    {
        if (Schema::hasTable('pet_assessment_form')) {
            return 'pet_assessment_form';
        }

        if (Schema::hasTable('pet_health_forms')) {
            return 'pet_health_forms';
        }

        return null;
    }

    public function up(): void
    {
        $tableName = $this->resolveTableName();

        if (!$tableName) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (!Schema::hasColumn($tableName, 'owner_id')) {
                $table->foreignUuid('owner_id')->nullable()->after('pet_id')->constrained('owners')->nullOnDelete();
            }

            if (!Schema::hasColumn($tableName, 'service_id')) {
                $table->foreignUuid('service_id')->nullable()->after('owner_id')->constrained('services')->nullOnDelete();
            }

            if (!Schema::hasColumn($tableName, 'appointment_id')) {
                $table->foreignUuid('appointment_id')->nullable()->after('service_id')->constrained('appointments')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        $tableName = $this->resolveTableName();

        if (!$tableName) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (Schema::hasColumn($tableName, 'appointment_id')) {
                $table->dropConstrainedForeignId('appointment_id');
            }

            if (Schema::hasColumn($tableName, 'service_id')) {
                $table->dropConstrainedForeignId('service_id');
            }

            if (Schema::hasColumn($tableName, 'owner_id')) {
                $table->dropConstrainedForeignId('owner_id');
            }
        });
    }
};
