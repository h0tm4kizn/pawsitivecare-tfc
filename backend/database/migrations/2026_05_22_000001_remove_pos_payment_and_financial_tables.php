<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('billing_ledger');
        Schema::dropIfExists('billing_ledgers');

        if (Schema::hasTable('appointments')) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_allowed_check');
                DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_deposit_non_negative_check');
            }

            try {
                Schema::table('appointments', function (Blueprint $table) {
                    $table->dropIndex('idx_appointments_payment_status');
                });
            } catch (\Throwable $e) {
                // Older databases may not have this performance index.
            }

            $columnsToDrop = array_values(array_filter(
                ['payment_status', 'mode_of_payment', 'bank_name', 'payment_date'],
                fn ($column) => Schema::hasColumn('appointments', $column)
            ));

            if ($columnsToDrop) {
                Schema::table('appointments', function (Blueprint $table) use ($columnsToDrop) {
                    $table->dropColumn($columnsToDrop);
                });
            }

            Schema::table('appointments', function (Blueprint $table) {
                if (! Schema::hasColumn('appointments', 'reservation_deposit_proof_url')) {
                    $table->string('reservation_deposit_proof_url')->nullable()->after('reference_number');
                }
            });
        }
    }

    public function down(): void
    {
        // POS/payment documentation tables and columns were intentionally removed.
    }
};
