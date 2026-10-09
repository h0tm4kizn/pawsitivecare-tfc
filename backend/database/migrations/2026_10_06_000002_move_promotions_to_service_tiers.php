<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('promotion_service_tier', function (Blueprint $table) {
            $table->uuid('promotion_id');
            $table->uuid('service_tier_id');
            $table->primary(['promotion_id', 'service_tier_id']);
            $table->foreign('promotion_id')->references('id')->on('promotions')->cascadeOnDelete();
            $table->foreign('service_tier_id')->references('id')->on('service_tiers')->cascadeOnDelete();
        });
        DB::table('promotion_service')->orderBy('promotion_id')->get()->each(function ($row) {
            DB::table('service_tiers')->where('service_id', $row->service_id)->pluck('id')->each(function ($tierId) use ($row) {
                DB::table('promotion_service_tier')->insertOrIgnore(['promotion_id' => $row->promotion_id, 'service_tier_id' => $tierId]);
            });
        });
        Schema::dropIfExists('promotion_service');
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_service_tier');
        Schema::create('promotion_service', function (Blueprint $table) {
            $table->uuid('promotion_id');
            $table->uuid('service_id');
            $table->primary(['promotion_id', 'service_id']);
        });
    }
};
