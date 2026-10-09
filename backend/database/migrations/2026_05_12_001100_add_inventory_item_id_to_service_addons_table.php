<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            $table->foreignUuid('inventory_item_id')->nullable()->after('is_active')
                ->constrained('inventory')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            $table->dropForeign(['inventory_item_id']);
            $table->dropColumn('inventory_item_id');
        });
    }
};
