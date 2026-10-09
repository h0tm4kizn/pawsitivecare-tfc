<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            if (!Schema::hasColumn('pets', 'recognition_registered')) {
                $table->boolean('recognition_registered')->default(false)->after('identification_image_url');
            }
            if (!Schema::hasColumn('pets', 'recognition_registered_at')) {
                $table->timestamp('recognition_registered_at')->nullable()->after('recognition_registered');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $drops = [];
            if (Schema::hasColumn('pets', 'recognition_registered_at')) {
                $drops[] = 'recognition_registered_at';
            }
            if (Schema::hasColumn('pets', 'recognition_registered')) {
                $drops[] = 'recognition_registered';
            }
            if (!empty($drops)) {
                $table->dropColumn($drops);
            }
        });
    }
};

