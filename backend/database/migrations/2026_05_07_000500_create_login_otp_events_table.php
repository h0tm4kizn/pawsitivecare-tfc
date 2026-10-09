<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_otp_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('challenge_id')->nullable();
            $table->string('event_type', 80);
            $table->string('status', 20);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent_hash', 128)->nullable();
            $table->json('metadata')->nullable();
            $table->timestampsTz();

            $table->index('user_id');
            $table->index('challenge_id');
            $table->index(['event_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_otp_events');
    }
};

