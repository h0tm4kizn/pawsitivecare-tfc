<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            if (!Schema::hasColumn('service_addons', 'addon_group')) {
                $table->string('addon_group', 100)->nullable()->after('category');
            }
            if (!Schema::hasColumn('service_addons', 'tier_label')) {
                $table->string('tier_label', 80)->nullable()->after('addon_group');
            }
            if (!Schema::hasColumn('service_addons', 'applies_to_grooming')) {
                $table->boolean('applies_to_grooming')->default(false)->after('has_size_pricing');
            }
            if (!Schema::hasColumn('service_addons', 'applies_to_daycare')) {
                $table->boolean('applies_to_daycare')->default(false)->after('applies_to_grooming');
            }
            if (!Schema::hasColumn('service_addons', 'applies_to_hotel')) {
                $table->boolean('applies_to_hotel')->default(false)->after('applies_to_daycare');
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            foreach (['applies_to_hotel', 'applies_to_daycare', 'applies_to_grooming', 'tier_label', 'addon_group'] as $column) {
                if (Schema::hasColumn('service_addons', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
