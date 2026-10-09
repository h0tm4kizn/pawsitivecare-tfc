<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_otp_challenges', function (Blueprint $table) {
            if (!Schema::hasColumn('login_otp_challenges', 'resend_count')) {
                $table->unsignedSmallInteger('resend_count')->default(0)->after('max_attempts');
            }
            if (!Schema::hasColumn('login_otp_challenges', 'max_resends')) {
                $table->unsignedSmallInteger('max_resends')->default(5)->after('resend_count');
            }
            if (!Schema::hasColumn('login_otp_challenges', 'last_sent_at')) {
                $table->timestampTz('last_sent_at')->nullable()->after('max_resends');
            }
        });
    }

    public function down(): void
    {
        Schema::table('login_otp_challenges', function (Blueprint $table) {
            $drops = [];
            if (Schema::hasColumn('login_otp_challenges', 'resend_count')) $drops[] = 'resend_count';
            if (Schema::hasColumn('login_otp_challenges', 'max_resends')) $drops[] = 'max_resends';
            if (Schema::hasColumn('login_otp_challenges', 'last_sent_at')) $drops[] = 'last_sent_at';
            if (!empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};

