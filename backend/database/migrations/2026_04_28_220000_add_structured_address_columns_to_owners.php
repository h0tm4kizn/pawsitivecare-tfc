<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            if (!Schema::hasColumn('owners', 'address_unit_floor')) {
                $table->string('address_unit_floor', 120)->nullable()->after('address');
            }
            if (!Schema::hasColumn('owners', 'address_street')) {
                $table->string('address_street', 255)->nullable()->after('address_unit_floor');
            }
            if (!Schema::hasColumn('owners', 'address_barangay')) {
                $table->string('address_barangay', 120)->nullable()->after('address_street');
            }
            if (!Schema::hasColumn('owners', 'address_city')) {
                $table->string('address_city', 120)->nullable()->after('address_barangay');
            }
            if (!Schema::hasColumn('owners', 'address_province')) {
                $table->string('address_province', 120)->nullable()->after('address_city');
            }
            if (!Schema::hasColumn('owners', 'address_postal_code')) {
                $table->string('address_postal_code', 10)->nullable()->after('address_province');
            }
            if (!Schema::hasColumn('owners', 'address_country')) {
                $table->string('address_country', 2)->nullable()->after('address_postal_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            foreach (['address_country','address_postal_code','address_province','address_city','address_barangay','address_street','address_unit_floor'] as $col) {
                if (Schema::hasColumn('owners', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
