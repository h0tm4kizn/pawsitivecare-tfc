<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->string('reservation_payment_account_id', 80)->nullable()->after('reservation_provider');
            $table->string('reservation_payer_provider', 80)->nullable()->after('reservation_payment_account_id');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['reservation_payment_account_id', 'reservation_payer_provider']);
        });
    }
};
