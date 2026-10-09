<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add appointment documentation fields for internal record-keeping.
     * These fields allow admin and staff to document payment transactions.
     * 
     * Fields:
     * - mode_of_payment: Payment method used (e-wallet, bank, cash, etc.)
     * - payment_date: Date when payment was recorded
     * - deposit: Deposit amount (for documentation purposes)
     * - reference_number: Transaction or booking reference ID
     */
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->string('mode_of_payment', 100)->nullable()->after('payment_status');
            $table->date('payment_date')->nullable()->after('mode_of_payment');
            $table->decimal('deposit', 10, 2)->nullable()->after('payment_date');
            $table->string('reference_number', 255)->nullable()->after('deposit');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['mode_of_payment', 'payment_date', 'deposit', 'reference_number']);
        });
    }
};
