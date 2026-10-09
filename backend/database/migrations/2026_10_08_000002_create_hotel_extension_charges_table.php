<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('hotel_extension_charges', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('appointment_id')->unique()->constrained('appointments')->cascadeOnDelete();
            $table->string('pet_species', 20);
            $table->string('pet_size', 20);
            $table->foreignUuid('daycare_service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->foreignUuid('daycare_tier_id')->nullable()->constrained('service_tiers')->nullOnDelete();
            $table->string('daycare_tier_label', 80);
            $table->decimal('hourly_rate', 12, 2);
            $table->dateTime('scheduled_checkout_at');
            $table->dateTime('actual_checkout_at');
            $table->unsignedInteger('extra_minutes');
            $table->unsignedInteger('billable_hours');
            $table->decimal('amount', 12, 2);
            $table->decimal('payment_amount', 12, 2);
            $table->string('payment_method', 30);
            $table->string('payment_status', 20);
            $table->string('payment_reference', 100)->nullable();
            $table->foreignUuid('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('recorded_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hotel_extension_charges');
    }
};
