<?php

namespace Tests\Feature;

use Database\Seeders\HotelSuiteSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class HotelExtensionMigrationSmokeTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_dashboard_calendar_and_reminders_work_with_extension_table_migrated(): void
    {
        $this->seed(HotelSuiteSeeder::class);
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $hotelServiceId = $this->createService('hotel');

        $this->assertDatabaseHas('migrations', [
            'migration' => '2026_10_08_000002_create_hotel_extension_charges_table',
        ]);
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('hotel_extension_charges'));

        $this->getJson('/api/admin/dashboard/overview')->assertOk();
        $this->getJson('/api/admin/dashboard/day')->assertOk();
        $this->getJson('/api/admin/dashboard/week')->assertOk();
        $this->getJson('/api/appointments/hotel-calendar?service_id=' . $hotelServiceId . '&month=' . now('Asia/Manila')->format('Y-m'))->assertOk();
        $this->getJson('/api/notifications')->assertOk();

        Mail::fake();
        $this->artisan('appointments:send-reminders')->assertSuccessful();
    }
}
