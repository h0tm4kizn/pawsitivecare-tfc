<?php

namespace Database\Seeders;

use App\Models\ShopHoursSetting;
use Illuminate\Database\Seeder;

class ShopHourSeeder extends Seeder
{
    /**
     * Seed default shop hours into the shop_hours key-value settings table.
     */
    public function run(): void
    {
        ShopHoursSetting::set('shop_hours', [
            'mon' => '9:00 AM - 5:00 PM',
            'tue' => '9:00 AM - 5:00 PM',
            'wed' => '9:00 AM - 5:00 PM',
            'thu' => '9:00 AM - 5:00 PM',
            'fri' => '9:00 AM - 5:00 PM',
            'sat' => '9:00 AM - 5:00 PM',
            'sun' => '9:00 AM - 5:00 PM',
        ]);

        ShopHoursSetting::set('shop_hours_raw', [
            'mon' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'tue' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'wed' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'thu' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'fri' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'sat' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
            'sun' => ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
        ]);
    }
}

