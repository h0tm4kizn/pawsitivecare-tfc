<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('notifications', 'metadata')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->json('metadata')->nullable()->after('message');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'metadata')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
