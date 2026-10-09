<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Updated appointments table migration to match actual Supabase schema
     */
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('pet_id')->nullable();
            $table->uuid('service_id');
            $table->uuid('hotel_suite_id')->nullable();
            $table->uuid('handled_by')->nullable();
            $table->uuid('booked_by_owner_id')->nullable();
            $table->string('size_label', 20)->nullable();
            $table->string('status', 255)->default('approved');
            $table->date('appointment_date');
            $table->time('start_time')->nullable();
            $table->timestamp('check_in_time')->nullable();
            $table->timestamp('check_out_time')->nullable();
            $table->string('daycare_duration', 255)->nullable();
            $table->integer('hotel_nights')->nullable();
            $table->text('special_instructions')->nullable();
            $table->decimal('total_price')->default(0);
            $table->string('payment_status', 255)->default('unpaid');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->boolean('is_full_day_package')->default(false);
            $table->decimal('grooming_discount')->nullable();
            $table->text('cancellation_reason')->nullable();
            
            // Foreign key constraints
            $table->foreign('pet_id')->references('id')->on('pets')->onDelete('set null');
            $table->foreign('service_id')->references('id')->on('services');
            $table->foreign('hotel_suite_id')->references('id')->on('hotel_suites');
            $table->foreign('handled_by')->references('id')->on('users');
            $table->foreign('booked_by_owner_id')->references('id')->on('owners');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
