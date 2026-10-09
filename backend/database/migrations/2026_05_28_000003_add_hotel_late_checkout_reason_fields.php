<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'late_checkout_reason')) {
                $table->string('late_checkout_reason', 50)->nullable()->after('actual_check_out_at');
            }
            if (!Schema::hasColumn('appointments', 'late_checkout_other_reason')) {
                $table->text('late_checkout_other_reason')->nullable()->after('late_checkout_reason');
            }
            if (!Schema::hasColumn('appointments', 'late_checkout_staff_notes')) {
                $table->text('late_checkout_staff_notes')->nullable()->after('late_checkout_other_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'late_checkout_staff_notes')) {
                $table->dropColumn('late_checkout_staff_notes');
            }
            if (Schema::hasColumn('appointments', 'late_checkout_other_reason')) {
                $table->dropColumn('late_checkout_other_reason');
            }
            if (Schema::hasColumn('appointments', 'late_checkout_reason')) {
                $table->dropColumn('late_checkout_reason');
            }
        });
    }
};

