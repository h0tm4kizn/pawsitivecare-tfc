<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('pets:birthday-notifications')->dailyAt('08:00')->timezone('Asia/Manila');
Schedule::command('appointments:send-reminders')->dailyAt('08:00');

