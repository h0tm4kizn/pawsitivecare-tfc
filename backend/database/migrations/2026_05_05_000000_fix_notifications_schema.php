<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add subject column that the controller already selects but was missing from schema
        if (! Schema::hasColumn('notifications', 'subject')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('subject', 255)->nullable()->after('owner_id');
            });
        }

        // Make appointment_id nullable so birthday/welcome notifications
        // can exist without an appointment context. SQLite already permits
        // nullable columns in tests and does not support ALTER COLUMN.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE notifications ALTER COLUMN appointment_id DROP NOT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'subject')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('subject');
            });
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE notifications ALTER COLUMN appointment_id SET NOT NULL');
        }
    }
};
