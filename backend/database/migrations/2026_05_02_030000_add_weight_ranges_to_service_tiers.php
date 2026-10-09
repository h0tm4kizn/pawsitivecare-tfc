<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_tiers', function (Blueprint $table) {
            if (!Schema::hasColumn('service_tiers', 'min_weight_kg')) {
                $table->decimal('min_weight_kg', 6, 2)->nullable()->after('size_label');
            }
            if (!Schema::hasColumn('service_tiers', 'max_weight_kg')) {
                $table->decimal('max_weight_kg', 6, 2)->nullable()->after('min_weight_kg');
            }
        });

        // Backfill based on canonical size labels (prices unchanged).
        DB::statement("\n            UPDATE service_tiers\n            SET\n                min_weight_kg = CASE\n                    WHEN UPPER(size_label) IN ('S', 'SMALL') OR UPPER(size_label) LIKE '% - SMALL' THEN 0\n                    WHEN UPPER(size_label) IN ('M', 'MEDIUM') OR UPPER(size_label) LIKE '% - MEDIUM' THEN 6\n                    WHEN UPPER(size_label) IN ('L', 'LARGE') OR UPPER(size_label) LIKE '% - LARGE' THEN 11\n                    WHEN UPPER(size_label) IN ('XL', 'XLARGE', 'X-LARGE') OR UPPER(size_label) LIKE '% - XLARGE' OR UPPER(size_label) LIKE '% - X-LARGE' THEN 15\n                    WHEN UPPER(size_label) IN ('XXL', 'XX-LARGE', 'XXLARGE') OR UPPER(size_label) LIKE '% - XXL' OR UPPER(size_label) LIKE '% - XXLARGE' THEN 20\n                    ELSE NULL\n                END,\n                max_weight_kg = CASE\n                    WHEN UPPER(size_label) IN ('S', 'SMALL') OR UPPER(size_label) LIKE '% - SMALL' THEN 5\n                    WHEN UPPER(size_label) IN ('M', 'MEDIUM') OR UPPER(size_label) LIKE '% - MEDIUM' THEN 10\n                    WHEN UPPER(size_label) IN ('L', 'LARGE') OR UPPER(size_label) LIKE '% - LARGE' THEN 15\n                    WHEN UPPER(size_label) IN ('XL', 'XLARGE', 'X-LARGE') OR UPPER(size_label) LIKE '% - XLARGE' OR UPPER(size_label) LIKE '% - X-LARGE' THEN 20\n                    WHEN UPPER(size_label) IN ('XXL', 'XX-LARGE', 'XXLARGE') OR UPPER(size_label) LIKE '% - XXL' OR UPPER(size_label) LIKE '% - XXLARGE' THEN NULL\n                    ELSE NULL\n                END\n        ");
    }

    public function down(): void
    {
        Schema::table('service_tiers', function (Blueprint $table) {
            if (Schema::hasColumn('service_tiers', 'max_weight_kg')) {
                $table->dropColumn('max_weight_kg');
            }
            if (Schema::hasColumn('service_tiers', 'min_weight_kg')) {
                $table->dropColumn('min_weight_kg');
            }
        });
    }
};
