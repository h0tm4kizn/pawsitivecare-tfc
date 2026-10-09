<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->jsonb('value');
            $table->timestamp('updated_at')->nullable();
        });

        // Seed defaults
        $now = now();
        DB::table('clinic_settings')->insert([
            [
                'key'        => 'schedule.grooming',
                'value'      => json_encode([
                    'days'          => [1, 2, 3, 4, 5, 6], // Mon–Sat (0=Sun)
                    'open'          => '09:00',
                    'close'         => '17:00',
                    'interval_mins' => 60,
                ]),
                'updated_at' => $now,
            ],
            [
                'key'        => 'schedule.hotel',
                'value'      => json_encode([
                    'days'      => [0, 1, 2, 3, 4, 5, 6], // Every day
                    'check_in'  => '10:00',
                    'check_out' => '12:00',
                ]),
                'updated_at' => $now,
            ],
            [
                'key'        => 'schedule.daycare',
                'value'      => json_encode([
                    'days'  => [1, 2, 3, 4, 5, 6], // Mon–Sat
                    'open'  => '08:00',
                    'close' => '17:00',
                ]),
                'updated_at' => $now,
            ],
            [
                'key'        => 'blocked_dates',
                'value'      => json_encode([]),
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_settings');
    }
};
