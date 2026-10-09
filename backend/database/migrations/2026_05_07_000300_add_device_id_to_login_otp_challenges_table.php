<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_otp_challenges', function (Blueprint $table) {
            if (!Schema::hasColumn('login_otp_challenges', 'device_id')) {
                $table->string('device_id', 120)->nullable()->after('user_id');
                $table->index('device_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('login_otp_challenges', function (Blueprint $table) {
            if (Schema::hasColumn('login_otp_challenges', 'device_id')) {
                $table->dropIndex(['device_id']);
                $table->dropColumn('device_id');
            }
        });
    }
};

