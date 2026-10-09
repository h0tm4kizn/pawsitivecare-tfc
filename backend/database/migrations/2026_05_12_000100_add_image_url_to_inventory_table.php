<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('inventory') || Schema::hasColumn('inventory', 'image_url')) {
            return;
        }

        Schema::table('inventory', function (Blueprint $table) {
            $table->text('image_url')->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('inventory') || ! Schema::hasColumn('inventory', 'image_url')) {
            return;
        }

        Schema::table('inventory', function (Blueprint $table) {
            $table->dropColumn('image_url');
        });
    }
};
