<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->string('discount_type', 30);
            $table->decimal('discount_value', 10, 2)->nullable();
            $table->decimal('promotional_price', 10, 2)->nullable();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['is_active', 'starts_on', 'ends_on']);
        });

        Schema::create('promotion_service', function (Blueprint $table) {
            $table->uuid('promotion_id');
            $table->uuid('service_id');
            $table->primary(['promotion_id', 'service_id']);
            $table->foreign('promotion_id')->references('id')->on('promotions')->cascadeOnDelete();
            $table->foreign('service_id')->references('id')->on('services')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_service');
        Schema::dropIfExists('promotions');
    }
};
