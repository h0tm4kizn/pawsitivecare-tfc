<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->foreignUuid('created_by')->nullable()->after('description')->constrained('users')->nullOnDelete();
            $table->foreignUuid('updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $table->index('created_by');
            $table->index('updated_by');
        });

    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropForeign(['updated_by']);
            $table->dropIndex(['created_by']);
            $table->dropIndex(['updated_by']);
            $table->dropColumn(['created_by', 'updated_by']);
        });
    }
};
