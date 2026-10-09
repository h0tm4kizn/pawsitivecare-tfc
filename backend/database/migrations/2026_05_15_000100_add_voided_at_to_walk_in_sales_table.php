<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->timestamp('voided_at')->nullable()->after('sold_at');
            $table->foreignUuid('voided_by')->nullable()->constrained('users')->nullOnDelete()->after('voided_at');
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->dropForeign(['voided_by']);
            $table->dropColumn(['voided_at', 'voided_by']);
        });
    }
};
