<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->string('reservation_channel', 30)->nullable()->after('reference_number');
            $table->string('reservation_provider', 80)->nullable()->after('reservation_channel');
            $table->timestamp('capacity_hold_expires_at')->nullable()->after('reservation_provider');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['reservation_channel', 'reservation_provider', 'capacity_hold_expires_at']);
        });
    }
};
