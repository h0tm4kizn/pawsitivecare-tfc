<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->foreignUuid('appointment_id')
                ->nullable()
                ->after('receipt_number')
                ->constrained('appointments')
                ->nullOnDelete();

            $table->index('appointment_id');
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_sales', function (Blueprint $table) {
            $table->dropForeign(['appointment_id']);
            $table->dropColumn('appointment_id');
        });
    }
};
