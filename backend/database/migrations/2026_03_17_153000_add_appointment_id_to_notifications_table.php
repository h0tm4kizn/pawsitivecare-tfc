<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('notifications', 'appointment_id')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->uuid('appointment_id')->nullable()->after('owner_id');
                $table->foreign('appointment_id')->references('id')->on('appointments')->nullOnDelete();
                $table->index(['appointment_id', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'appointment_id')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropIndex('notifications_appointment_id_status_index');
                $table->dropForeign(['appointment_id']);
                $table->dropColumn('appointment_id');
            });
        }
    }
};
