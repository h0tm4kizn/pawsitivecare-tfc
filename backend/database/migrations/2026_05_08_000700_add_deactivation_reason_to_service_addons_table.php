<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            if (!Schema::hasColumn('service_addons', 'deactivation_reason')) {
                $table->text('deactivation_reason')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            if (Schema::hasColumn('service_addons', 'deactivation_reason')) {
                $table->dropColumn('deactivation_reason');
            }
        });
    }
};
