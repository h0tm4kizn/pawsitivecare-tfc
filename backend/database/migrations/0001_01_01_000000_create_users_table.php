<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Updated users table migration to match actual Supabase schema
     * This reflects the REAL structure that Laravel uses (ignoring Supabase Auth columns)
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('email', 150)->nullable(); // Note: unique constraint exists but not in migration due to Supabase Auth
            $table->text('password_hash');
            $table->string('role', 255)->default('staff'); // Changed from enum to varchar to match actual
            $table->string('staff_type', 255)->nullable(); // Changed from enum to varchar to match actual
            $table->boolean('is_active')->default(true);
            $table->string('remember_token', 100)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->string('phone', 30)->nullable()->unique(); // Added phone field with unique constraint
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
