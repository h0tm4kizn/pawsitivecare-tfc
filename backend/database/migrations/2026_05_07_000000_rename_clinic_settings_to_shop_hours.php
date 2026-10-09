<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('clinic_settings') && !Schema::hasTable('shop_hours')) {
            Schema::rename('clinic_settings', 'shop_hours');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('shop_hours') && !Schema::hasTable('clinic_settings')) {
            Schema::rename('shop_hours', 'clinic_settings');
        }
    }
};

