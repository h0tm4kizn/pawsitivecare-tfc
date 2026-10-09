<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('appointments')
            ->where('status', 'confirmed')
            ->update(['status' => 'approved']);
    }

    public function down(): void
    {
        DB::table('appointments')
            ->where('status', 'approved')
            ->update(['status' => 'confirmed']);
    }
};
