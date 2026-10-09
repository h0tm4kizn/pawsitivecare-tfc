<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->text('qr_credential')->nullable();
        });

        Schema::table('staff_attendance', function (Blueprint $table): void {
            $table->uuid('recorded_by')->nullable();
            $table->string('recording_method', 24)->nullable();
            $table->foreign('recorded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('staff_attendance', function (Blueprint $table): void {
            $table->dropForeign(['recorded_by']);
            $table->dropColumn(['recorded_by', 'recording_method']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('qr_credential');
        });
    }
};
