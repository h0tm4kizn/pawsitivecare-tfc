<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rename biometric columns to identification terminology
     * Aligns with PawsitiveCare branding: "Pet Identification" instead of "biometric"
     */
    public function up(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            // Rename columns to use "identification" terminology
            $table->renameColumn('biometric_hash', 'identification_hash');
            $table->renameColumn('biometric_image_url', 'identification_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            // Revert to old names
            $table->renameColumn('identification_hash', 'biometric_hash');
            $table->renameColumn('identification_image_url', 'biometric_image_url');
        });
    }
};
