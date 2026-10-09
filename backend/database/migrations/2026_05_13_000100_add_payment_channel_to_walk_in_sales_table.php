<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->string('payment_channel', 60)->nullable()->after('payment_method');
            $table->string('reference_number', 100)->nullable()->after('payment_channel');
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->dropColumn(['payment_channel', 'reference_number']);
        });
    }
};
