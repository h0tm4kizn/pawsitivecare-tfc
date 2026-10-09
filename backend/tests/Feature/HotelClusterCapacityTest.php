<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\ShopHoursSetting;
use App\Services\HotelClusterAllocator;
use Database\Seeders\HotelSuiteSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class HotelClusterCapacityTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private string $hotelServiceId;
    private string $dogSpeciesId;
    private string $dogBreedId;
    private string $ownerId;
    private string $adminId;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-01 12:00:00', 'Asia/Manila'));
        $this->seed(HotelSuiteSeeder::class);
        $this->hotelServiceId = $this->createService('hotel');
        $this->dogSpeciesId = $this->createSpeciesType();
        $this->dogBreedId = $this->createBreed($this->dogSpeciesId);
        $this->ownerId = $this->createOwner();
        $this->adminId = $this->createAdminUser()->id;
        ShopHoursSetting::set('cages', ['A' => 6, 'B' => 6, 'C' => 3, 'D' => 3]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_shared_suite_categories_use_remaining_cluster_capacity(): void
    {
        $allocator = app(HotelClusterAllocator::class);
        $emptySnapshot = $allocator->clusterInventory('A', '2026-10-10', 1, $this->ownerId);
        $this->assertSame(6, $emptySnapshot['available']);

        $catSpecies = $this->createSpeciesType('Cat', 'C');
        $catBreed = $this->createBreed($catSpecies, 'Domestic Shorthair');
        $catOwner = $this->createOwner();
        $this->createHotelAppointment('The Cozy Whiskers', '2026-10-10', $catOwner, $catSpecies, $catBreed);

        $snapshot = $allocator->clusterInventory('A', '2026-10-10', 1, $this->ownerId);
        $this->assertSame(6, $snapshot['capacity']);
        $this->assertSame(1, $snapshot['occupied']);
        $this->assertSame(5, $snapshot['available']);

        for ($i = 0; $i < 4; $i++) {
            $this->createHotelAppointment('The Cozy Paw Suite', '2026-10-10');
        }
        $snapshot = $allocator->clusterInventory('A', '2026-10-10', 1, $this->ownerId);
        $this->assertSame(1, $snapshot['available']);

        $this->createHotelAppointment('The Cozy Whiskers', '2026-10-10');
        $snapshot = $allocator->clusterInventory('A', '2026-10-10', 1, $this->ownerId);
        $this->assertSame(0, $snapshot['available']);
        $this->assertFalse($snapshot['is_available']);

        $this->createHotelAppointment('The Cozy Paw Suite', '2026-10-10', null, null, null, 'cancelled');
        $this->createHotelAppointment('The Cozy Paw Suite', '2026-10-10', null, null, null, 'no_show');
        $this->assertSame(0, $allocator->clusterInventory('A', '2026-10-10', 1)['available']);
    }

    public function test_multi_night_capacity_uses_each_nights_occupancy_not_range_total(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->createHotelAppointment('The Cozy Paw Suite', '2026-10-10', null, null, null, 'approved', 1);
            $this->createHotelAppointment('The Cozy Whiskers', '2026-10-11', null, null, null, 'approved', 1);
        }

        $snapshot = app(HotelClusterAllocator::class)->clusterInventory('A', '2026-10-10', 2);
        $this->assertSame(4, $snapshot['occupied']);
        $this->assertSame(2, $snapshot['available']);
        $this->assertSame(2, $snapshot['daily']['2026-10-10']['available']);
        $this->assertSame(2, $snapshot['daily']['2026-10-11']['available']);
    }

    public function test_checked_in_pet_without_checkout_keeps_capacity_after_scheduled_end(): void
    {
        $appointment = $this->createHotelAppointment(
            'The Cozy Paw Suite',
            '2026-09-25',
            $this->ownerId,
            $this->dogSpeciesId,
            $this->dogBreedId,
            'in_progress',
            1,
            '2026-09-25 10:00:00'
        );

        $snapshot = app(HotelClusterAllocator::class)->clusterInventory('A', '2026-10-10', 1);
        $this->assertSame(1, $snapshot['occupied']);
        $this->assertSame(5, $snapshot['available']);

        $appointment->update(['actual_check_out_at' => '2026-10-01 11:00:00']);
        $snapshot = app(HotelClusterAllocator::class)->clusterInventory('A', '2026-10-10', 1);
        $this->assertSame(0, $snapshot['occupied']);
    }

    public function test_cluster_c_uses_three_shared_units_across_its_suite_categories(): void
    {
        $this->createHotelAppointment('The Grand Paw Suite', '2026-10-10');
        $this->createHotelAppointment('The VIPaws Suite', '2026-10-10');
        $this->createHotelAppointment('The Grand Paw Suite', '2026-10-10');

        $snapshot = app(HotelClusterAllocator::class)->clusterInventory('C', '2026-10-10', 1);
        $this->assertSame(3, $snapshot['capacity']);
        $this->assertSame(3, $snapshot['occupied']);
        $this->assertSame(0, $snapshot['available']);
    }

    public function test_cluster_b_shares_six_units_between_dog_and_cat_suites(): void
    {
        $catSpecies = $this->createSpeciesType('Cat', 'C');
        $catBreed = $this->createBreed($catSpecies, 'Domestic Shorthair');
        $this->createHotelAppointment('The Happy Paws Suite', '2026-10-10');
        for ($i = 0; $i < 4; $i++) {
            $ownerId = $this->createOwner();
            $this->createHotelAppointment('The Grand Purr Suite', '2026-10-10', $ownerId, $catSpecies, $catBreed);
        }

        $allocator = app(HotelClusterAllocator::class);
        $this->assertSame(1, $allocator->clusterInventory('B', '2026-10-10', 1)['available']);
        $this->createHotelAppointment('The Happy Paws Suite', '2026-10-10');
        $this->assertSame(0, $allocator->clusterInventory('B', '2026-10-10', 1)['available']);
    }

    public function test_cluster_d_groups_households_and_enforces_five_pet_limit_count(): void
    {
        $catSpecies = $this->createSpeciesType('Cat', 'C');
        $catBreed = $this->createBreed($catSpecies, 'Domestic Shorthair');
        for ($i = 0; $i < 2; $i++) {
            $this->createHotelAppointment('The VIPurr Villa', '2026-10-10', $this->ownerId, $catSpecies, $catBreed);
        }
        $otherOwner = $this->createOwner();
        $this->createHotelAppointment('The VIPurr Villa', '2026-10-10', $otherOwner, $catSpecies, $catBreed);

        $allocator = app(HotelClusterAllocator::class);
        $forSameHousehold = $allocator->clusterInventory('D', '2026-10-10', 1, $this->ownerId);
        $this->assertSame(1, $forSameHousehold['occupied']);
        $this->assertSame(2, $forSameHousehold['available']);
        $this->assertSame(2, $allocator->householdPetCount($this->ownerId, '2026-10-10', 1));

        for ($i = 0; $i < 3; $i++) {
            $this->createHotelAppointment('The VIPurr Villa', '2026-10-10', $this->ownerId, $catSpecies, $catBreed);
        }
        $this->assertSame(5, $allocator->householdPetCount($this->ownerId, '2026-10-10', 1));
    }

    public function test_calendar_returns_full_and_shared_capacity_details(): void
    {
        $samePetReservation = $this->createHotelAppointment('The Cozy Whiskers', '2026-10-10');
        $shopHours = array_fill_keys(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], '9:00 AM - 5:00 PM');
        ShopHoursSetting::set('shop_hours', $shopHours);
        ShopHoursSetting::set('schedule.hotel', ['days' => [0, 1, 2, 3, 4, 5, 6]]);
        ShopHoursSetting::set('blocked_dates', []);
        Sanctum::actingAs(\App\Models\User::findOrFail($this->adminId));

        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');
        $petId = $this->createPet($this->ownerId, $this->dogSpeciesId, $this->dogBreedId);
        $samePetResponse = $this->getJson("/api/appointments/hotel-calendar?service_id={$this->hotelServiceId}&month=2026-10&suite_id={$suiteId}&pet_id={$samePetReservation->pet_id}")
            ->assertOk();
        $samePetDate = collect($samePetResponse->json('data.dates'))->firstWhere('date', '2026-10-10');
        $this->assertSame('unavailable', $samePetDate['status']);

        $response = $this->getJson("/api/appointments/hotel-calendar?service_id={$this->hotelServiceId}&month=2026-10&suite_id={$suiteId}&pet_id={$petId}")
            ->assertOk();
        $date = collect($response->json('data.dates'))->firstWhere('date', '2026-10-10');
        $this->assertSame('available', $date['status']);
        $this->assertSame(6, $date['capacity']);
        $this->assertSame(1, $date['occupied']);
        $this->assertSame(5, $date['available']);

        for ($i = 0; $i < 5; $i++) {
            $this->createHotelAppointment('The Cozy Paw Suite', '2026-10-10');
        }
        $response = $this->getJson("/api/appointments/hotel-calendar?service_id={$this->hotelServiceId}&month=2026-10&suite_id={$suiteId}&pet_id={$petId}")
            ->assertOk();
        $date = collect($response->json('data.dates'))->firstWhere('date', '2026-10-10');
        $this->assertSame('full', $date['status']);
        $this->assertSame(0, $date['available']);
    }

    private function createHotelAppointment(
        string $suiteName,
        string $date,
        ?string $ownerId = null,
        ?string $speciesId = null,
        ?string $breedId = null,
        string $status = 'approved',
        int $nights = 1,
        ?string $actualCheckInAt = null
    ): Appointment {
        $ownerId ??= $this->createOwner();
        $speciesId ??= $this->dogSpeciesId;
        $breedId ??= $this->dogBreedId;
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $id = $this->createAppointment($petId, $this->hotelServiceId, $this->adminId, $ownerId);
        $appointment = Appointment::query()->findOrFail($id);
        $appointment->update([
            'hotel_suite_id' => DB::table('hotel_suites')->where('name', $suiteName)->value('id'),
            'appointment_date' => $date,
            'hotel_nights' => $nights,
            'status' => $status,
            'actual_check_in_at' => $actualCheckInAt,
            'capacity_hold_expires_at' => $status === 'pending' ? now('Asia/Manila')->addMinutes(30) : null,
        ]);
        return $appointment->fresh();
    }
}
