<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100)->unique();
            $table->string('slug', 50)->unique();
            $table->string('color', 7)->default('#4DB6AC');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Seed the 3 existing categories
        DB::table('service_categories')->insert([
            ['id' => \Illuminate\Support\Str::uuid(), 'name' => 'Grooming', 'slug' => 'grooming', 'color' => '#4DB6AC', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => \Illuminate\Support\Str::uuid(), 'name' => 'Daycare',  'slug' => 'daycare',  'color' => '#fd6024', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => \Illuminate\Support\Str::uuid(), 'name' => 'Hotel',    'slug' => 'hotel',    'color' => '#093448', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('service_categories');
    }
};
