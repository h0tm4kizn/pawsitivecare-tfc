<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->string('payment_received_by', 30)->nullable()->after('payment_channel');
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->dropColumn('payment_received_by');
        });
    }
};
