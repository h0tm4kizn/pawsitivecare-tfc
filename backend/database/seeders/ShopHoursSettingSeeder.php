<?php

namespace Database\Seeders;

use App\Models\ShopHoursSetting;
use Illuminate\Database\Seeder;

class ShopHoursSettingSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

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

        ShopHoursSetting::set('cages', [
            'small' => 5,
            'medium' => 5,
            'large' => 5,
        ]);

        ShopHoursSetting::set('blocked_dates', []);

        ShopHoursSetting::set('schedule.grooming', [
            'days' => [1, 2, 3, 4, 5, 6],
            'open' => '09:00',
            'close' => '17:00',
            'interval_mins' => 60,
            'max_slots' => 6,
        ]);

        ShopHoursSetting::set('schedule.daycare', [
            'days' => [1, 2, 3, 4, 5, 6],
            'open' => '09:00',
            'close' => '17:00',
            'interval_mins' => 60,
            'max_slots' => 10,
        ]);

        ShopHoursSetting::set('schedule.hotel', [
            'days' => [0, 1, 2, 3, 4, 5, 6],
            'check_in' => '14:00',
            'check_out' => '12:00',
            'max_nights' => 30,
        ]);
    }
}

