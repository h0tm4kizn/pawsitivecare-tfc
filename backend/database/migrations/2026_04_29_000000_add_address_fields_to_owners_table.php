<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add individual address fields to owners table for detailed address breakdown
     */
    public function up(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            // Add individual address components if they don't exist
            if (!Schema::hasColumn('owners', 'unit_floor')) {
                $table->string('unit_floor', 100)->nullable()->after('address');
            }
            if (!Schema::hasColumn('owners', 'street_address')) {
                $table->string('street_address', 255)->nullable()->after('unit_floor');
            }
            if (!Schema::hasColumn('owners', 'barangay')) {
                $table->string('barangay', 100)->nullable()->after('street_address');
            }
            if (!Schema::hasColumn('owners', 'city_municipality')) {
                $table->string('city_municipality', 100)->nullable()->after('barangay');
            }
            if (!Schema::hasColumn('owners', 'province')) {
                $table->string('province', 100)->nullable()->after('city_municipality');
            }
            if (!Schema::hasColumn('owners', 'postal_code')) {
                $table->string('postal_code', 20)->nullable()->after('province');
            }
            if (!Schema::hasColumn('owners', 'country')) {
                $table->string('country', 50)->default('PH')->after('postal_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            if (Schema::hasColumn('owners', 'unit_floor')) $table->dropColumn('unit_floor');
            if (Schema::hasColumn('owners', 'street_address')) $table->dropColumn('street_address');
            if (Schema::hasColumn('owners', 'barangay')) $table->dropColumn('barangay');
            if (Schema::hasColumn('owners', 'city_municipality')) $table->dropColumn('city_municipality');
            if (Schema::hasColumn('owners', 'province')) $table->dropColumn('province');
            if (Schema::hasColumn('owners', 'postal_code')) $table->dropColumn('postal_code');
            if (Schema::hasColumn('owners', 'country')) $table->dropColumn('country');
        });
    }
};
