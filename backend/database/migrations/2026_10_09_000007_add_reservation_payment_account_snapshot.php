<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('appointments', 'reservation_payment_account_snapshot')) {
            Schema::table('appointments', function (Blueprint $table): void {
                $table->json('reservation_payment_account_snapshot')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('appointments', 'reservation_payment_account_snapshot')) {
            Schema::table('appointments', function (Blueprint $table): void {
                $table->dropColumn('reservation_payment_account_snapshot');
            });
        }
    }
};
