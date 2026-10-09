<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recognition_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('pet_id');
            $table->text('photo_url');
            $table->string('image_hash', 64);
            $table->timestamp('captured_at')->useCurrent();
            $table->timestamps();
            $table->foreign('pet_id')->references('id')->on('pets')->onDelete('cascade');
            $table->unique(['pet_id', 'image_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recognition_photos');
    }
};
