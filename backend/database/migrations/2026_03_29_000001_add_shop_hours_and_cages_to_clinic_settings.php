<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        
        // Add shop_hours setting if not exists
        if (!DB::table('clinic_settings')->where('key', 'shop_hours')->exists()) {
            DB::table('clinic_settings')->insert([
                'key'        => 'shop_hours',
                'value'      => json_encode([
                    'mon' => '8:00 AM - 9:00 PM',
                    'tue' => '8:00 AM - 9:00 PM',
                    'wed' => '8:00 AM - 9:00 PM',
                    'thu' => '8:00 AM - 9:00 PM',
                    'fri' => '8:00 AM - 9:00 PM',
                    'sat' => '9:00 AM - 11:00 PM',
                    'sun' => 'Closed',
                ]),
                'updated_at' => $now,
            ]);
        }

        // Add cages setting if not exists
        if (!DB::table('clinic_settings')->where('key', 'cages')->exists()) {
            DB::table('clinic_settings')->insert([
                'key'        => 'cages',
                'value'      => json_encode([
                    'small'  => 5,
                    'medium' => 5,
                    'large'  => 5,
                ]),
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('clinic_settings')->whereIn('key', ['shop_hours', 'cages'])->delete();
    }
};
