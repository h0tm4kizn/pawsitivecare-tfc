<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointment_booked_packages', function (Blueprint $table) {
            $table->id();
            $table->string('booked_package_id', 32)->unique();
            $table->foreignUuid('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignUuid('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('package_id', 20);
            $table->string('service_type', 20);
            $table->string('package_name', 120);
            $table->unsignedInteger('sequence_order');
            $table->string('status', 30)->default('pending');
            $table->decimal('price', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['appointment_id', 'sequence_order']);
            $table->index('package_id');
            $table->index('service_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_booked_packages');
    }
};

