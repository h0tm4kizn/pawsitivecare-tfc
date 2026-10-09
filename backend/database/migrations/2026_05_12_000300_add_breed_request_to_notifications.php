<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        // Add metadata column for structured breed request data
        if (! Schema::hasColumn('notifications', 'metadata')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->jsonb('metadata')->nullable()->after('message');
            });
        }

        // Extend the type check constraint to include breed_request.
        // We drop any existing check and recreate it with all known values.
        DB::statement("
            ALTER TABLE notifications
            DROP CONSTRAINT IF EXISTS notifications_type_check
        ");
        DB::statement("
            ALTER TABLE notifications
            ADD CONSTRAINT notifications_type_check
            CHECK (type IN ('reminder','confirmation','followup','new_pet','breed_request'))
        ");

        // Ensure in_app is allowed in the channel column
        DB::statement("
            ALTER TABLE notifications
            DROP CONSTRAINT IF EXISTS notifications_channel_check
        ");
        DB::statement("
            ALTER TABLE notifications
            ADD CONSTRAINT notifications_channel_check
            CHECK (channel IN ('phone','email','in_app'))
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE notifications
            DROP CONSTRAINT IF EXISTS notifications_type_check
        ");
        DB::statement("
            ALTER TABLE notifications
            ADD CONSTRAINT notifications_type_check
            CHECK (type IN ('reminder','confirmation','followup','new_pet'))
        ");

        DB::statement("
            ALTER TABLE notifications
            DROP CONSTRAINT IF EXISTS notifications_channel_check
        ");
        DB::statement("
            ALTER TABLE notifications
            ADD CONSTRAINT notifications_channel_check
            CHECK (channel IN ('phone','email','in_app'))
        ");

        if (Schema::hasColumn('notifications', 'metadata')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
