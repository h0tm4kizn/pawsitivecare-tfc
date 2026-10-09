<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_attendance', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('staff_id');
            $table->timestamp('time_in_at');
            $table->timestamp('time_out_at')->nullable();
            $table->string('timezone', 64)->default('Asia/Manila');
            $table->timestamps();
            $table->foreign('staff_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['staff_id', 'time_in_at']);
        });

        Schema::create('commission_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('staff_id')->nullable();
            $table->string('service_category', 40)->nullable();
            $table->decimal('rate_percent', 5, 2)->default(0);
            $table->string('calculation_basis', 32)->default('final_service_price');
            $table->boolean('is_active')->default(true);
            $table->date('effective_from')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();
            $table->foreign('staff_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['staff_id', 'service_category', 'is_active']);
        });

        Schema::create('staff_commissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('staff_id');
            $table->uuid('appointment_id')->unique();
            $table->uuid('service_id')->nullable();
            $table->decimal('service_amount', 12, 2)->default(0);
            $table->decimal('commission_base_amount', 12, 2)->default(0);
            $table->decimal('rate_percent', 5, 2)->default(0);
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->string('calculation_basis', 32)->default('final_service_price');
            $table->timestamp('earned_at');
            $table->timestamps();
            $table->foreign('staff_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('appointment_id')->references('id')->on('appointments')->restrictOnDelete();
            $table->foreign('service_id')->references('id')->on('services')->nullOnDelete();
            $table->index(['staff_id', 'earned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_commissions');
        Schema::dropIfExists('commission_settings');
        Schema::dropIfExists('staff_attendance');
    }
};
