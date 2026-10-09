<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            if (!Schema::hasColumn('pets', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('photo_url');
            }
            if (!Schema::hasColumn('pets', 'deactivation_reason')) {
                $table->text('deactivation_reason')->nullable()->after('is_active');
            }
            if (!Schema::hasColumn('pets', 'deletion_reason')) {
                $table->text('deletion_reason')->nullable()->after('deactivation_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $drops = [];
            if (Schema::hasColumn('pets', 'deletion_reason')) {
                $drops[] = 'deletion_reason';
            }
            if (Schema::hasColumn('pets', 'deactivation_reason')) {
                $drops[] = 'deactivation_reason';
            }
            if (Schema::hasColumn('pets', 'is_active')) {
                $drops[] = 'is_active';
            }
            if (!empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};

