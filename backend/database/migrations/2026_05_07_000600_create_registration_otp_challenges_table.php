<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_otp_challenges', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email', 150);
            $table->string('phone', 11);
            $table->longText('payload_json');
            $table->string('code_hash');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(5);
            $table->unsignedSmallInteger('resend_count')->default(0);
            $table->unsignedSmallInteger('max_resends')->default(5);
            $table->timestampTz('last_sent_at')->nullable();
            $table->timestampTz('expires_at');
            $table->timestampsTz();

            $table->index(['email']);
            $table->index(['phone']);
            $table->index(['expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_otp_challenges');
    }
};

