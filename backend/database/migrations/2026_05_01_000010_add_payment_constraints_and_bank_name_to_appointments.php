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
            if (!Schema::hasColumn('appointments', 'bank_name')) {
                $table->string('bank_name', 120)->nullable()->after('mode_of_payment');
            }
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_allowed_check");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_payment_status_allowed_check CHECK (payment_status IN ('unpaid','pending','partial','partially_paid','paid'))");

        DB::statement("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_deposit_non_negative_check");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_deposit_non_negative_check CHECK (deposit IS NULL OR deposit >= 0)");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_allowed_check");
        DB::statement("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_deposit_non_negative_check");

        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'bank_name')) {
                $table->dropColumn('bank_name');
            }
        });
    }
};
