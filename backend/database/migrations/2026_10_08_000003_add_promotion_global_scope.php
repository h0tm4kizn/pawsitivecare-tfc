<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->boolean('applies_to_all_services')->default(false)->after('is_active');
            $table->boolean('applies_to_all_inventory')->default(false)->after('applies_to_all_services');
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn(['applies_to_all_services', 'applies_to_all_inventory']);
        });
    }
};
