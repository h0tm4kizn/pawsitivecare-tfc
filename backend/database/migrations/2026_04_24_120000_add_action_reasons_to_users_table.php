<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'deactivation_reason')) {
                $table->text('deactivation_reason')->nullable()->after('is_active');
            }
            if (!Schema::hasColumn('users', 'deletion_reason')) {
                $table->text('deletion_reason')->nullable()->after('deactivation_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'deletion_reason')) {
                $table->dropColumn('deletion_reason');
            }
            if (Schema::hasColumn('users', 'deactivation_reason')) {
                $table->dropColumn('deactivation_reason');
            }
        });
    }
};

