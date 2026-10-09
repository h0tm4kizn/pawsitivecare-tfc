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

        if (!Schema::hasColumn('notifications', 'dedupe_key')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('dedupe_key')->nullable()->unique()->after('subject');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'dedupe_key')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropUnique(['dedupe_key']);
                $table->dropColumn('dedupe_key');
            });
        }

        if (Schema::hasColumn('notifications', 'metadata')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
