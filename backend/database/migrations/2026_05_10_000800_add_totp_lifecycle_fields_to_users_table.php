<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('totp_pending_secret')->nullable()->after('totp_secret');
            $table->json('totp_recovery_codes')->nullable()->after('totp_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['totp_pending_secret', 'totp_recovery_codes']);
        });
    }
};

