<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // FK to owners — who receives this notification
            $table->uuid('owner_id');
            $table->foreign('owner_id')->references('id')->on('owners')->cascadeOnDelete();

            // FK to appointments — which appointment this notification is about
            $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->cascadeOnDelete();
            $table->text('message');
            $table->enum('channel', ['phone', 'email'])->default('email');
            $table->enum('type', ['reminder', 'confirmation', 'followup'])->default('reminder');
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');

            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            // Indexes for performance
            $table->index(['owner_id', 'status']);
            $table->index(['owner_id', 'is_read']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
