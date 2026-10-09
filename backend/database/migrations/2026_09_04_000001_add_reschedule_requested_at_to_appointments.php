<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('appointments', 'reschedule_requested_at')) {
            return;
        }

        Schema::table('appointments', function (Blueprint $table) {
            $table->timestamp('reschedule_requested_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('appointments', 'reschedule_requested_at')) {
            return;
        }

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn('reschedule_requested_at');
        });
    }
};
