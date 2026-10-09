<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'late_checkout_notes')) {
                $table->text('late_checkout_notes')->nullable()->after('actual_check_out_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'late_checkout_notes')) {
                $table->dropColumn('late_checkout_notes');
            }
        });
    }
};

