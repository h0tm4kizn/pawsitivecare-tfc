<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_trusted_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('device_id', 120);
            $table->string('user_agent_hash', 128)->nullable();
            $table->string('first_ip', 45)->nullable();
            $table->string('last_ip', 45)->nullable();
            $table->timestampTz('trusted_until')->nullable();
            $table->timestampTz('last_used_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'device_id']);
            $table->index('trusted_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_trusted_devices');
    }
};

