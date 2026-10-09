<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\HotelExtensionCharge;
use App\Services\HotelExtensionService;
use Database\Seeders\HotelSuiteSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class HotelExtensionChargeTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private string $petId;
    private string $ownerId;
    private string $hotelId;
    private string $daycareId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(HotelSuiteSeeder::class);
        $species = $this->createSpeciesType();
        $breed = $this->createBreed($species);
        $this->ownerId = $this->createOwner();
        $this->petId = $this->createPet($this->ownerId, $species, $breed);
        $this->hotelId = $this->createService('hotel');
        $this->daycareId = $this->createService('daycare');
        foreach (['Small' => 80, 'Medium' => 80, 'Large' => 100, 'XLarge' => 110] as $size => $rate) {
            DB::table('service_tiers')->insert([
                'id' => (string) Str::uuid(), 'service_id' => $this->daycareId,
                'size_label' => "Hourly - {$size}", 'price' => $rate,
                'duration_hours' => 1, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    private function hotel(string $size = 'Small', string $status = 'in_progress'): Appointment
    {
        $admin = $this->createAdminUser();
        $appointment = Appointment::findOrFail($this->createAppointment($this->petId, $this->hotelId, $admin->id, $this->ownerId));
        $appointment->update([
            'appointment_date' => now('Asia/Manila')->subDays(2)->toDateString(),
            'start_time' => '10:00:00', 'hotel_nights' => 1,
            'hotel_suite_id' => DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id'),
            'pet_size' => $size, 'status' => $status,
            'total_price' => 650, 'deposit' => 325,
            'reservation_channel' => 'cash',
            'actual_check_in_at' => $status === 'in_progress' ? now('Asia/Manila')->subDays(2)->setTime(10, 0) : null,
        ]);
        return $appointment->fresh()->load(['service', 'pet.speciesType']);
    }

    public function test_rounding_size_rates_and_historical_rate_snapshot(): void
    {
        $appointment = $this->hotel();
        $service = app(HotelExtensionService::class);
        $scheduled = $appointment->scheduled_check_out_at;
        $this->assertSame('10:00', $scheduled->format('H:i'));
        $this->assertSame(0, $service->preview($appointment, $scheduled)['amount']);
        $this->assertSame(0, $service->preview($appointment, $scheduled->copy()->subMinute())['amount']);
        $this->assertSame(80.0, $service->preview($appointment, $scheduled->copy()->addMinute())['amount']);
        $this->assertSame(160.0, $service->preview($appointment, $scheduled->copy()->addMinutes(61))['amount']);
        $this->assertSame(160.0, $service->preview($appointment, $scheduled->copy()->addMinutes(120))['amount']);
        $this->assertSame(240.0, $service->preview($appointment, $scheduled->copy()->addMinutes(121))['amount']);
        $this->assertSame(2080.0, $service->preview($appointment, $scheduled->copy()->addHours(26))['amount']);
        $appointment->start_time = '14:00:00';
        $this->assertSame('14:00', $appointment->scheduled_check_out_at->format('H:i'));
        $appointment->start_time = '10:00:00';
        foreach (['Medium' => 80, 'Large' => 100, 'XLarge' => 110] as $size => $rate) {
            $appointment->pet_size = $size;
            $this->assertSame((float) $rate, $service->preview($appointment, $scheduled->copy()->addMinute())['amount']);
        }

        $catSpecies = $this->createSpeciesType('Cat', 'C');
        DB::table('pets')->where('id', $this->petId)->update(['species_id' => $catSpecies]);
        $appointment->unsetRelation('pet')->load('pet.speciesType');
        foreach (['CAT', 'KITTEN'] as $size) {
            $appointment->pet_size = $size;
            $preview = $service->preview($appointment, $scheduled->copy()->addMinute());
            $this->assertSame($size, $preview['pet_size']);
            $this->assertSame('Hourly - Small', $preview['daycare_tier_label']);
            $this->assertSame(80.0, $preview['amount']);
        }
    }

    public function test_normal_checkout_requires_payment_and_is_idempotent(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $appointment = $this->hotel();
        $actual = $appointment->scheduled_check_out_at->copy()->addMinutes(61)->toDateTimeString();
        $path = "/api/appointments/{$appointment->id}";
        $this->postJson("{$path}/hotel-checkout-preview", ['actual_check_out_at' => $actual])
            ->assertOk()->assertJsonPath('data.billable_hours', 2)->assertJsonPath('data.amount', 160);
        $this->patchJson("{$path}/status", ['status' => 'completed', 'actual_check_out_at' => $actual])
            ->assertStatus(422);
        $this->patchJson("{$path}/status", [
            'status' => 'completed', 'actual_check_out_at' => $actual,
            'extension_payment_method' => 'cash', 'extension_payment_amount' => 80,
            'extension_payment_confirmed' => true,
        ])->assertStatus(422);
        $this->patchJson("{$path}/status", [
            'status' => 'completed', 'actual_check_out_at' => $actual,
            'extension_payment_method' => 'e_wallet', 'extension_payment_amount' => 160,
            'extension_payment_confirmed' => true,
        ])->assertStatus(422);
        $this->assertDatabaseCount('hotel_extension_charges', 0);
        $this->assertSame('in_progress', $appointment->fresh()->status);
        $payload = [
            'status' => 'completed', 'actual_check_out_at' => $actual,
            'extension_payment_method' => 'cash', 'extension_payment_amount' => 160,
            'extension_payment_confirmed' => true,
        ];
        $this->patchJson("{$path}/status", $payload)->assertOk()->assertJsonPath('data.status', 'completed');
        $this->patchJson("{$path}/status", $payload)->assertOk();
        $this->assertSame(1, HotelExtensionCharge::where('appointment_id', $appointment->id)->count());
        $this->assertDatabaseHas('hotel_extension_charges', [
            'appointment_id' => $appointment->id, 'pet_size' => 'Small',
            'billable_hours' => 2, 'amount' => 160, 'payment_amount' => 160,
            'payment_status' => 'paid', 'payment_method' => 'cash',
        ]);
        $this->assertSame(650.0, (float) $appointment->fresh()->total_price);
        $this->assertSame(325.0, (float) $appointment->fresh()->deposit);
        DB::table('service_tiers')->where('service_id', $this->daycareId)->where('size_label', 'Hourly - Small')->update(['price' => 999]);
        $this->getJson($path)->assertOk()
            ->assertJsonPath('data.hotel_extension_charge.amount', '160.00')
            ->assertJsonPath('data.hotel_extension_charge.recorded_by_name', $admin->name);
        $this->getJson("{$path}/history")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/reports/hotel-extensions?view=monthly&year=' . now('Asia/Manila')->year . '&month=' . now('Asia/Manila')->month)
            ->assertOk()
            ->assertJsonPath('data.summary.extension_charges', 160)
            ->assertJsonPath('data.records.0.amount', '160.00')
            ->assertJsonPath('data.records.0.payment_amount', '160.00')
            ->assertJsonPath('data.records.0.payment_method', 'cash')
            ->assertJsonPath('data.records.0.payment_status', 'paid')
            ->assertJsonPath('data.records.0.recorded_by', $admin->name)
            ->assertJsonPath('data.records.0.handled_by', $admin->name);
        $this->getJson('/api/reports/hotel-extensions?view=monthly&year=' . now('Asia/Manila')->year . '&month=' . now('Asia/Manila')->month . '&from=' . now('Asia/Manila')->subDay()->toDateString() . '&to=' . now('Asia/Manila')->subDay()->toDateString())
            ->assertOk()->assertJsonPath('data.summary.extension_charges', 0);
    }

    public function test_missing_or_ambiguous_daycare_rate_blocks_late_checkout(): void
    {
        $appointment = $this->hotel('Large');
        $actual = $appointment->scheduled_check_out_at->copy()->addMinute();
        $appointment->pet_size = null;
        try {
            app(HotelExtensionService::class)->preview($appointment, $actual);
            $this->fail('Missing pet size was accepted.');
        } catch (\Illuminate\Validation\ValidationException $error) {
            $this->assertArrayHasKey('pet_size', $error->errors());
        }
        $appointment->pet_size = 'Large';
        DB::table('service_tiers')->where('service_id', $this->daycareId)->where('size_label', 'Hourly - Large')->delete();
        try {
            app(HotelExtensionService::class)->preview($appointment, $actual);
            $this->fail('Missing tier was accepted.');
        } catch (\Illuminate\Validation\ValidationException $error) {
            $this->assertArrayHasKey('daycare_rate', $error->errors());
        }
        DB::table('service_tiers')->insert([
            'id' => (string) Str::uuid(), 'service_id' => $this->daycareId,
            'size_label' => 'Hourly - Large', 'price' => 100,
            'duration_hours' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('service_tiers')->insert([
            'id' => (string) Str::uuid(), 'service_id' => $this->daycareId,
            'size_label' => 'Hourly - Large', 'price' => 110,
            'duration_hours' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        try {
            app(HotelExtensionService::class)->preview($appointment, $actual);
            $this->fail('Ambiguous tiers were accepted.');
        } catch (\Illuminate\Validation\ValidationException $error) {
            $this->assertArrayHasKey('daycare_rate', $error->errors());
        }
    }

    public function test_on_time_checkout_completes_without_extension_payment(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $appointment = $this->hotel();
        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            'status' => 'completed',
            'actual_check_out_at' => $appointment->scheduled_check_out_at->toDateTimeString(),
        ])->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseCount('hotel_extension_charges', 0);
        $this->getJson("/api/appointments/{$appointment->id}/history")
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'hotel_checkout_completed');
    }

    public function test_normal_checkout_must_be_after_actual_check_in(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $appointment = $this->hotel();

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            'status' => 'completed',
            'actual_check_out_at' => $appointment->actual_check_in_at->toDateTimeString(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['actual_check_out_at']);

        $this->assertSame('in_progress', $appointment->fresh()->status);
        $this->assertDatabaseCount('hotel_extension_charges', 0);
    }

    public function test_missed_checkin_completion_records_same_extension_charge(): void
    {
        $admin = $this->createAdminUser();
        $staff = $this->createStaffUser();
        Sanctum::actingAs($admin);
        $appointment = $this->hotel('Small', 'approved');
        $actual = $appointment->scheduled_check_out_at->copy()->addMinute();
        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            'status' => 'completed', 'confirm_hotel_stay_completed' => true,
            'actual_check_in_at' => $appointment->scheduled_check_in_at->toDateTimeString(),
            'actual_check_out_at' => $actual->toDateTimeString(),
            'missed_checkin_reason' => 'Manual correction', 'handled_by' => $staff->id,
        ])->assertStatus(422);
        $this->assertDatabaseCount('hotel_extension_charges', 0);
        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            'status' => 'completed', 'confirm_hotel_stay_completed' => true,
            'actual_check_in_at' => $appointment->scheduled_check_in_at->toDateTimeString(),
            'actual_check_out_at' => $actual->toDateTimeString(),
            'missed_checkin_reason' => 'Manual correction', 'handled_by' => $staff->id,
            'extension_payment_method' => 'cash', 'extension_payment_amount' => 80,
            'extension_payment_confirmed' => true,
        ])->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('hotel_extension_charges', ['appointment_id' => $appointment->id, 'amount' => 80]);
        $this->getJson("/api/appointments/{$appointment->id}/history")->assertOk()->assertJsonCount(2, 'data');
    }
}
