<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('payment_id', 40)->nullable()->unique(); // optional business id
            $table->foreignUuid('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->decimal('amount_paid', 12, 2);
            $table->enum('payment_type', ['deposit', 'final_balance', 'adjustment', 'refund']);
            $table->string('payment_channel', 100)->nullable(); // GCash/Maya/Bank/Cash
            $table->string('bank_name', 120)->nullable();
            $table->string('reference_number', 120)->nullable();
            $table->date('payment_date')->nullable();
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->foreignUuid('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('appointment_id');
            $table->index(['verification_status', 'payment_type']);
            $table->index('reference_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};

