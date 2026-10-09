<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'actual_check_in_at')) {
                $table->timestamp('actual_check_in_at')->nullable()->after('check_out_time');
            }
            if (!Schema::hasColumn('appointments', 'actual_check_out_at')) {
                $table->timestamp('actual_check_out_at')->nullable()->after('actual_check_in_at');
            }
        });

        // Remove deprecated late-charge setting key if table/key store exists in this environment.
        if (Schema::hasTable('shop_hours_settings')) {
            DB::table('shop_hours_settings')->where('key', 'late_charge_per_hour')->delete();
        }
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'actual_check_out_at')) {
                $table->dropColumn('actual_check_out_at');
            }
            if (Schema::hasColumn('appointments', 'actual_check_in_at')) {
                $table->dropColumn('actual_check_in_at');
            }
        });
    }
};
