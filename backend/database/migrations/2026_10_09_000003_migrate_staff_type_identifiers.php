<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('staff_type', 'technical')->update(['staff_type' => 'front_desk']);
        DB::table('users')->where('staff_type', 'field')->update(['staff_type' => 'groomer']);
    }

    public function down(): void
    {
        DB::table('users')->where('staff_type', 'front_desk')->update(['staff_type' => 'technical']);
        DB::table('users')->where('staff_type', 'groomer')->update(['staff_type' => 'field']);
    }
};
