<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\ShopHoursSetting;
use App\Models\StaffAttendance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;
use Database\Seeders\ShopHoursSettingSeeder;
use Database\Seeders\HotelSuiteSeeder;

/**
 * Tasks:
 * - #106 Appointment booking + status flow
 * - #107 Combo discount logic
 * - #110b Appointment past date rejection
 * - #110c Double-booking blocked
 */
class AppointmentFlowTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private string $speciesId;
    private string $breedId;
    private string $ownerId;
    private string $petId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ShopHoursSettingSeeder::class);
        $this->seed(HotelSuiteSeeder::class);

        $this->speciesId = $this->createSpeciesType();
        $this->breedId = $this->createBreed($this->speciesId);
        $this->ownerId = $this->createOwner();
        $this->petId = $this->createPet($this->ownerId, $this->speciesId, $this->breedId);
        $this->createPetAssessment($this->petId, $this->ownerId);
        ShopHoursSetting::set('payment_accounts', [[
            'id' => 'gcash-main',
            'type' => 'ewallet',
            'label' => 'GCash',
            'account_name' => 'The Fur Club',
            'account_number' => '09171234567',
            'qr_code' => 'https://example.test/gcash-qr.png',
        ]]);
    }

    private function createServiceTier(string $serviceId, string $sizeLabel, float $price): void
    {
        DB::table('service_tiers')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'service_id' => $serviceId,
            'size_label' => $sizeLabel,
            'price' => $price,
            'duration_hours' => 1.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_admin_can_book_and_move_status_to_completed(): void
    {
        $admin = $this->createAdminUser();
        $staff = $this->createStaffUser('groomer');
        StaffAttendance::create([
            'staff_id' => $staff->id,
            'time_in_at' => now('Asia/Manila'),
            'timezone' => 'Asia/Manila',
        ]);
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('grooming');
        $this->createServiceTier($serviceId, 'medium', 500.00);
        $appointmentDate = now('Asia/Manila')->addWeek()->startOfWeek()->toDateString();

        $book = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => $appointmentDate,
            'start_time' => '10:00:00',
        ]);

        $book->assertStatus(201)->assertJsonPath('status', 201);
        $appointmentId = $book->json('data.id');

        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'approved'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        Appointment::findOrFail($appointmentId)->update([
            'appointment_date' => now('Asia/Manila')->toDateString(),
        ]);

        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'in_progress'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_progress');

        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'completed',
            'handled_by' => $staff->id,
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('appointments', [
            'id' => $appointmentId,
            'status' => 'completed',
        ]);
    }

    public function test_combo_discount_applies_for_grooming_when_daycare_exists_same_day(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $date = now()->addDays(2)->toDateString();

        $daycareServiceId = $this->createService('daycare');
        $groomingServiceId = $this->createService('grooming');

        $this->createServiceTier($groomingServiceId, 'medium', 1000.00);

        // Existing daycare appointment on same pet/date triggers grooming discount logic.
        $this->createAppointment($this->petId, $daycareServiceId, $admin->id, $this->ownerId);
        Appointment::query()->latest('created_at')->first()?->update([
            'appointment_date' => $date,
            'start_time' => '08:00:00',
        ]);

        $book = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $groomingServiceId,
            'size_label' => 'medium',
            'appointment_date' => $date,
            'start_time' => '10:00:00',
        ]);

        $book->assertStatus(201)
            ->assertJsonPath('data.is_full_day_package', true)
            ->assertJsonPath('data.grooming_discount', 100)
            ->assertJsonPath('data.total_price', 900);
    }

    public function test_appointment_past_date_is_rejected(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('grooming');
        $this->createServiceTier($serviceId, 'medium', 500.00);

        $response = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => now()->subDay()->toDateString(),
            'start_time' => '09:00:00',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrorFor('appointment_date');
    }

    public function test_double_booking_same_slot_is_blocked(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('grooming');
        $this->createServiceTier($serviceId, 'medium', 500.00);

        $date = now()->addDays(3)->toDateString();

        $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        Appointment::query()->latest('created_at')->first()?->update([
            'appointment_date' => $date,
            'start_time' => '11:00:00',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => $date,
            'start_time' => '11:00:00',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'This time slot is already booked for the selected service.');
    }

    public function test_grooming_slot_availability_marks_full_slots_and_ignores_completed_appointments(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('grooming');
        $date = now('Asia/Manila')->addDays(4)->toDateString();

        $appointmentId = $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        Appointment::query()->findOrFail($appointmentId)->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'pending',
        ]);

        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$serviceId}&size_label=medium");
        $response->assertOk()
            ->assertJsonPath('data.slot_statuses.1.time', '10:00:00')
            ->assertJsonPath('data.slot_statuses.1.status', 'full');
        $this->assertNotContains('10:00:00', $response->json('data.slots'));

        Appointment::query()->findOrFail($appointmentId)->update(['status' => 'completed']);
        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$serviceId}&size_label=medium");
        $response->assertOk();
        $this->assertContains('10:00:00', $response->json('data.slots'));
    }

    public function test_grooming_slots_fit_inside_configured_closing_time(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('grooming');
        $date = now('Asia/Manila')->addDays(4)->toDateString();
        $dayKey = strtolower(now('Asia/Manila')->addDays(4)->format('D'));
        ShopHoursSetting::set('shop_hours', array_merge(ShopHoursSetting::get('shop_hours', []), [$dayKey => '9:00 AM - 6:00 PM']));

        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$serviceId}&size_label=medium");
        $response->assertOk();
        $this->assertContains('17:00:00', $response->json('data.slots'));
        $this->assertNotContains('18:00:00', $response->json('data.slots'));
    }

    public function test_grooming_walk_in_starts_immediately_and_releases_capacity_when_completed(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $staff = $this->createStaffUser('groomer');
        StaffAttendance::create([
            'staff_id' => $staff->id,
            'time_in_at' => now('Asia/Manila'),
            'timezone' => 'Asia/Manila',
        ]);
        $serviceId = $this->createService('grooming');
        $this->createServiceTier($serviceId, 'medium', 500.00);
        $date = now('Asia/Manila')->toDateString();
        $time = now('Asia/Manila')->startOfMinute()->format('H:i:s');

        ShopHoursSetting::set('shop_hours', array_merge(ShopHoursSetting::get('shop_hours', []), [
            strtolower(now('Asia/Manila')->format('D')) => '12:00 AM - 11:59 PM',
        ]));

        $payload = [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => $date,
            'start_time' => $time,
            'booking_source' => 'walk_in',
            'handled_by' => $staff->id,
        ];
        $first = $this->postJson('/api/appointments', $payload);
        $first->assertCreated()->assertJsonPath('data.status', 'in_progress');
        $appointmentId = $first->json('data.id');
        $this->assertNotNull(Appointment::query()->findOrFail($appointmentId)->actual_check_in_at);

        $this->postJson('/api/appointments', $payload)
            ->assertStatus(409)
            ->assertJsonPath('message', 'This time slot is already full. Please select another date or time.');

        Appointment::query()->findOrFail($appointmentId)->update(['status' => 'completed']);
        $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$serviceId}&size_label=medium&walk_in=1")
            ->assertOk()
            ->assertJsonPath('data.walk_in_status', 'available');
    }

    public function test_pending_grooming_approval_rechecks_capacity_and_leaves_conflicting_booking_pending(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('grooming');
        $date = now('Asia/Manila')->addDays(5)->toDateString();
        $firstId = $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        $conflictingId = $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        Appointment::query()->findOrFail($firstId)->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'approved',
        ]);
        Appointment::query()->findOrFail($conflictingId)->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'pending',
        ]);

        $this->patchJson("/api/appointments/{$conflictingId}/status", ['status' => 'approved'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'This time slot is already full. Please select another date or time.');
        $this->assertDatabaseHas('appointments', ['id' => $conflictingId, 'status' => 'pending']);
    }

    public function test_valid_pending_grooming_approval_changes_status_once(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('grooming');
        $date = now('Asia/Manila')->addDays(5)->toDateString();
        $appointmentId = $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        Appointment::query()->findOrFail($appointmentId)->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'pending',
        ]);

        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
        $this->assertSame(1, Appointment::query()->whereKey($appointmentId)->count());
    }

    public function test_hotel_approval_rejects_full_shared_cluster_without_changing_pending_status(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $hotelServiceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');
        $date = now('Asia/Manila')->addDays(7)->toDateString();
        ShopHoursSetting::set('cages', ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0]);

        $appointmentId = $this->createAppointment($this->petId, $hotelServiceId, $admin->id, $this->ownerId);
        Appointment::query()->findOrFail($appointmentId)->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'pet_size' => 'Small',
            'status' => 'pending',
            'capacity_hold_expires_at' => now('Asia/Manila')->addMinutes(10),
        ]);

        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'approved'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'No Hotel Suite is available for the selected dates. Please choose another date or suite.');
        $this->assertDatabaseHas('appointments', ['id' => $appointmentId, 'status' => 'pending']);
    }

    public function test_admin_can_complete_past_approved_appointment_without_check_in(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('daycare');

        $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        $appointment = Appointment::query()->latest('created_at')->first();
        $appointment?->update([
            'appointment_date' => now('Asia/Manila')->subDay()->toDateString(),
            'start_time' => '09:00:00',
            'status' => 'approved',
        ]);

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'completed'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => 'completed',
        ]);
    }

    public function test_past_approved_hotel_can_be_cancelled_or_marked_no_show_without_checkout_records(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $pastDate = now('Asia/Manila')->subDays(2)->toDateString();

        $cancelled = Appointment::query()->findOrFail(
            $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
        );
        $cancelled->update([
            'appointment_date' => $pastDate,
            'start_time' => '10:00:00',
            'status' => 'approved',
        ]);

        $this->patchJson("/api/appointments/{$cancelled->id}/status", [
            'status' => 'cancelled',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Cancellation reason is required when cancelling an appointment.');

        $this->patchJson("/api/appointments/{$cancelled->id}/status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Owner did not arrive',
        ])->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('appointments', [
            'id' => $cancelled->id,
            'status' => 'cancelled',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);
        $cancelledAt = Appointment::findOrFail($cancelled->id)->cancelled_at;
        $this->patchJson("/api/appointments/{$cancelled->id}/status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'duplicate request',
        ])->assertOk();
        $this->assertSame($cancelledAt?->toIso8601String(), Appointment::findOrFail($cancelled->id)->cancelled_at?->toIso8601String());

        $noShow = Appointment::query()->findOrFail(
            $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
        );
        $noShow->update([
            'appointment_date' => $pastDate,
            'start_time' => '10:00:00',
            'status' => 'approved',
        ]);

        $this->patchJson("/api/appointments/{$noShow->id}/status", ['status' => 'no_show'])
            ->assertOk()
            ->assertJsonPath('data.status', 'no_show');

        $this->assertDatabaseHas('appointments', [
            'id' => $noShow->id,
            'status' => 'no_show',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);
    }

    public function test_hotel_stay_requires_confirmed_historical_check_in_and_check_out_before_completion(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $daycareServiceId = $this->createService('daycare');
        $this->createServiceTier($daycareServiceId, 'Hourly - Small', 80.00);
        $appointment = Appointment::query()->findOrFail(
            $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
        );
        $appointment->update([
            'appointment_date' => now('Asia/Manila')->subDays(3)->toDateString(),
            'start_time' => '10:00:00',
            'hotel_suite_id' => DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id'),
            'hotel_nights' => 2,
            'pet_size' => 'Small',
            'status' => 'approved',
        ]);

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'completed'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Record the actual Hotel Suite check-in and start the stay before completing this appointment.');

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'in_progress'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Confirm the actual check-in date and time before starting this Hotel Suite stay.');
        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => 'approved',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);

        $this->putJson("/api/appointments/{$appointment->id}", [
            'actual_check_in_at' => now('Asia/Manila')->addHour()->toDateTimeString(),
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Actual check-in cannot be in the future.');

        $checkIn = now('Asia/Manila')->subDays(3)->setTime(10, 25);
        $this->putJson("/api/appointments/{$appointment->id}", [
            'actual_check_in_at' => $checkIn->toDateTimeString(),
        ])->assertOk();

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'in_progress'])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress');

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'completed'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Confirm the actual check-out date and time before completing this Hotel Suite appointment.');

        $checkOut = now('Asia/Manila')->subDays(1)->setTime(11, 10);
        $this->putJson("/api/appointments/{$appointment->id}", [
            'actual_check_out_at' => $checkOut->toDateTimeString(),
        ])->assertOk();

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            'status' => 'completed',
            'actual_check_out_at' => $checkOut->toDateTimeString(),
            'extension_payment_method' => 'cash',
            'extension_payment_amount' => 160,
            'extension_payment_confirmed' => true,
        ])->assertOk()->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => 'completed',
            'actual_check_in_at' => $checkIn->toDateTimeString(),
            'actual_check_out_at' => $checkOut->toDateTimeString(),
        ]);

        $this->patchJson("/api/appointments/{$appointment->id}/status", ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('message', 'Appointment status is already up to date.');
    }

    public function test_admin_can_complete_hotel_stay_with_confirmed_missed_check_in_correction(): void
    {
        $admin = $this->createAdminUser();
        $assignedStaff = $this->createStaffUser('groomer', 'stay');
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $appointment = Appointment::query()->findOrFail(
            $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
        );
        $appointment->update([
            'status' => 'approved',
            'handled_by' => $assignedStaff->id,
            'hotel_suite_id' => DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id'),
            'hotel_nights' => 2,
            'pet_size' => 'Small',
            'total_price' => 1300,
            'deposit' => 650,
            'reservation_channel' => 'cash',
        ]);

        $checkIn = now('Asia/Manila')->subHours(5)->startOfMinute();
        $checkOut = now('Asia/Manila')->subHours(2)->startOfMinute();
        $payload = [
            'status' => 'completed',
            'confirm_hotel_stay_completed' => true,
            'actual_check_in_at' => $checkIn->toDateTimeString(),
            'actual_check_out_at' => $checkOut->toDateTimeString(),
            'missed_checkin_reason' => 'Front desk did not enter the check-in at arrival.',
            'actor_id' => $assignedStaff->id,
            'handled_by' => $assignedStaff->id,
        ];

        $optionsResponse = $this->getJson('/api/appointments/hotel-handler-options?per_page=100')
            ->assertOk();
        $eligibleHandlers = collect($optionsResponse->json('data.data'));
        $this->assertTrue($eligibleHandlers->contains('id', $assignedStaff->id));
        $this->assertFalse($eligibleHandlers->contains('id', $admin->id));

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'confirm_hotel_stay_completed' => false,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Confirm that the pet stayed and the Hotel Suite service was completed.');

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'missed_checkin_reason' => '',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'A reason for the missed check-in recording is required.');

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'actual_check_out_at' => null,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Enter the actual check-in and check-out date and time.');

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'actual_check_out_at' => $checkIn->toDateTimeString(),
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Actual check-out must be after the actual check-in.');

        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'actual_check_in_at' => now('Asia/Manila')->addHour()->toDateTimeString(),
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Actual check-in cannot be in the future.');

        $customerUser = $this->createCustomerUser();
        $this->patchJson("/api/appointments/{$appointment->id}/status", [
            ...$payload,
            'handled_by' => $customerUser->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'The selected Handled By staff member is unavailable. Select an active staff member.');

        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'status' => 'approved',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);

        $this->patchJson("/api/appointments/{$appointment->id}/status", $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $saved = Appointment::query()->findOrFail($appointment->id);
        $this->assertSame('completed', $saved->status);
        $this->assertSame($checkIn->toDateTimeString(), $saved->actual_check_in_at->toDateTimeString());
        $this->assertSame($checkOut->toDateTimeString(), $saved->actual_check_out_at->toDateTimeString());
        $this->assertSame($assignedStaff->id, $saved->handled_by);
        $this->assertStringContainsString('Front desk did not enter the check-in at arrival.', $saved->late_checkin_staff_notes);
        $this->assertStringContainsString((string) $admin->id, $saved->late_checkin_staff_notes);
        $this->assertNotNull($saved->completed_at);
        $occupants = collect(app(\App\Services\HotelClusterAllocator::class)->currentOccupancySnapshot()['clusters'])
            ->flatMap(fn (array $cluster) => $cluster['occupants'])
            ->pluck('appointment_id');
        $this->assertNotContains($appointment->id, $occupants);

        $historyResponse = $this->getJson("/api/appointments/{$appointment->id}/history")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'hotel_missed_checkin_completed')
            ->assertJsonPath('data.0.actor_name', $admin->name)
            ->assertJsonPath('data.0.metadata.previous_status', 'approved')
            ->assertJsonPath('data.0.metadata.new_status', 'completed')
            ->assertJsonPath('data.0.metadata.confirmed_stay_completed', true)
            ->assertJsonPath('data.0.metadata.handled_by_name', $assignedStaff->name)
            ->assertJsonPath('data.0.metadata.handled_by_role', 'Staff (Groomer)')
            ->assertJsonPath('data.0.metadata.handled_by_id', $assignedStaff->id)
            ->assertJsonPath('data.0.metadata.recorded_by_name', $admin->name)
            ->assertJsonPath('data.0.metadata.recorded_by_role', 'Admin')
            ->assertJsonPath('data.0.metadata.recorded_by_id', $admin->id)
            ->assertJsonPath('data.0.metadata.correction_reason', 'Front desk did not enter the check-in at arrival.');
        $historyRecord = AuditLog::query()->findOrFail($historyResponse->json('data.0.id'));
        $this->assertSame($appointment->id, $historyRecord->metadata['appointment_id']);
        $this->assertSame($checkIn->toIso8601String(), $historyRecord->metadata['actual_check_in_at']);
        $this->assertSame($checkOut->toIso8601String(), $historyRecord->metadata['actual_check_out_at']);
        $this->assertNotEmpty($historyRecord->metadata['scheduled_check_in_at']);
        $this->assertNotEmpty($historyRecord->metadata['scheduled_check_out_at']);
        $this->assertNotEmpty($historyRecord->metadata['recorded_at']);

        $this->patchJson("/api/appointments/{$appointment->id}/status", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'This appointment is no longer eligible for missed check-in completion.');
        $this->assertSame(1, AuditLog::query()
            ->where('action', 'hotel_missed_checkin_completed')
            ->where('metadata->appointment_id', $appointment->id)
            ->count());
    }

    public function test_missed_hotel_check_in_completion_rejects_missing_deposit_and_ineligible_appointments(): void
    {
        $admin = $this->createAdminUser();
        $handledBy = $this->createStaffUser('front_desk', 'correction');
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');
        $payload = [
            'status' => 'completed',
            'confirm_hotel_stay_completed' => true,
            'actual_check_in_at' => now('Asia/Manila')->subHours(5)->toDateTimeString(),
            'actual_check_out_at' => now('Asia/Manila')->subHours(2)->toDateTimeString(),
            'missed_checkin_reason' => 'Correction test.',
            'handled_by' => $handledBy->id,
        ];

        $unpaid = Appointment::query()->findOrFail(
            $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
        );
        $unpaid->update([
            'status' => 'approved',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 2,
            'total_price' => 500,
            'deposit' => 0,
            'reservation_channel' => 'cash',
        ]);
        $this->patchJson("/api/appointments/{$unpaid->id}/status", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'The Hotel Suite reservation must retain its required 50% deposit before completion.');
        $this->assertDatabaseHas('appointments', [
            'id' => $unpaid->id,
            'status' => 'approved',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);

        foreach (['cancelled', 'no_show', 'completed'] as $status) {
            $ineligible = Appointment::query()->findOrFail(
                $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId)
            );
            $ineligible->update([
                'status' => $status,
                'hotel_suite_id' => $suiteId,
                'hotel_nights' => 2,
                'total_price' => 500,
                'deposit' => 250,
                'reservation_channel' => 'cash',
            ]);
            $this->patchJson("/api/appointments/{$ineligible->id}/status", $payload)
                ->assertStatus(422)
                ->assertJsonPath('message', 'This appointment is no longer eligible for missed check-in completion.');
        }
    }

    public function test_hotel_check_in_slots_follow_shop_hours_when_approved_booking_exists(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $hotelServiceId = $this->createService('hotel');
        $date = now()->addDays(2)->toDateString();

        // Create a approved hotel appointment
        $this->createAppointment($this->petId, $hotelServiceId, $admin->id, $this->ownerId);
        Appointment::query()->latest('created_at')->first()?->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'approved',
        ]);

        // Suite capacity is handled by the hotel calendar/allocator.
        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}");

        $response->assertStatus(200)
            ->assertJsonCount(8, 'data.slots')
            ->assertJsonPath('data.slots.0', '09:00:00')
            ->assertJsonPath('data.slots.7', '16:00:00');
    }

    public function test_live_hotel_occupancy_counts_actual_checkins_only_and_returns_operational_times(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $hotelServiceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');
        $today = now('Asia/Manila')->toDateString();

        $checkedIn = Appointment::query()->findOrFail($this->createAppointment($this->petId, $hotelServiceId, $admin->id, $this->ownerId));
        $checkedIn->update([
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'appointment_date' => $today,
            'start_time' => '10:00:00',
            'status' => 'in_progress',
            'actual_check_in_at' => now('Asia/Manila')->subMinutes(15),
            'actual_check_out_at' => null,
        ]);

        // An approved reservation without an actual check-in must not appear as a current occupant.
        $reserved = Appointment::query()->findOrFail($this->createAppointment($this->petId, $hotelServiceId, $admin->id, $this->ownerId));
        $reserved->update([
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'appointment_date' => $today,
            'start_time' => '10:00:00',
            'status' => 'approved',
            'actual_check_in_at' => null,
            'actual_check_out_at' => null,
        ]);

        $response = $this->getJson('/api/admin/hotel-suites/live-occupancy?date=' . $today);
        $response->assertOk()
            ->assertJsonPath('data.hotel_occupied', 1)
            ->assertJsonPath('data.hotel_available', 17)
            ->assertJsonPath('data.hotel_dogs', 1)
            ->assertJsonPath('data.hotel_cats', 0)
            ->assertJsonCount(1, 'data.cluster_breakdown.0.occupants');

        $occupant = $response->json('data.cluster_breakdown.0.occupants.0');
        $this->assertSame($checkedIn->id, $occupant['appointment_id']);
        $this->assertNotNull($occupant['checked_in_at']);
        $this->assertNotNull($occupant['expected_out_at']);
        $this->assertFalse($occupant['overdue']);

        $checkedIn->update([
            'status' => 'completed',
            'actual_check_out_at' => now('Asia/Manila'),
        ]);

        $this->getJson('/api/admin/hotel-suites/live-occupancy?date=' . $today)
            ->assertOk()
            ->assertJsonPath('data.hotel_occupied', 0)
            ->assertJsonPath('data.hotel_available', 18)
            ->assertJsonCount(0, 'data.cluster_breakdown.0.occupants');
    }

    public function test_hotel_appointment_not_occupied_when_only_pending_booking_exists(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $hotelServiceId = $this->createService('hotel');
        $date = now()->addDays(2)->toDateString();

        // Create a pending hotel appointment (not approved)
        $this->createAppointment($this->petId, $hotelServiceId, $admin->id, $this->ownerId);
        Appointment::query()->latest('created_at')->first()?->update([
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'status' => 'pending',
        ]);

        // Check available slots - pending reservations do not remove hourly times.
        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}");

        $response->assertStatus(200)
            ->assertJsonCount(8, 'data.slots')
            ->assertJsonMissing(['data.reason' => 'occupied']);
    }

    public function test_hotel_check_in_slots_are_generated_from_current_shop_hours_and_exclude_past_times(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $hotelServiceId = $this->createService('hotel');
        $date = now('Asia/Manila')->addDays(2)->toDateString();
        $dayKey = strtolower(\Illuminate\Support\Carbon::parse($date)->format('D'));
        $shopHours = array_fill_keys(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], '9:00 AM - 6:00 PM');
        ShopHoursSetting::set('shop_hours', [
            ...$shopHours,
        ]);

        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}");
        $response->assertOk()
            ->assertJsonCount(18, 'data.slots')
            ->assertJsonPath('data.slots.0', '09:00:00')
            ->assertJsonPath('data.slots.1', '09:30:00')
            ->assertJsonPath('data.slots.2', '10:00:00')
            ->assertJsonPath('data.slots.3', '10:30:00')
            ->assertJsonPath('data.slots.17', '17:30:00');

        \Illuminate\Support\Carbon::setTestNow("{$date} 11:00:00 Asia/Manila");
        try {
            $todayResponse = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}");
            $todayResponse->assertOk()
                ->assertJsonCount(13, 'data.slots')
                ->assertJsonPath('data.slots.0', '11:30:00')
                ->assertJsonPath('data.slots.1', '12:00:00');
        } finally {
            \Illuminate\Support\Carbon::setTestNow();
        }

        ShopHoursSetting::set('shop_hours', array_merge(ShopHoursSetting::get('shop_hours', []), [$dayKey => 'closed']));
        $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}")
            ->assertOk()
            ->assertJsonCount(0, 'data.slots')
            ->assertJsonPath('data.reason', 'closed');

        ShopHoursSetting::set('shop_hours', array_merge(ShopHoursSetting::get('shop_hours', []), [$dayKey => '9:00 AM - 6:00 PM']));
        ShopHoursSetting::set('blocked_dates', [$date]);
        $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}")
            ->assertOk()
            ->assertJsonCount(0, 'data.slots')
            ->assertJsonPath('data.reason', 'blocked');

        ShopHoursSetting::set('blocked_dates', []);
        $hotelSchedule = ShopHoursSetting::get('schedule.hotel', []);
        $hotelSchedule['days'] = array_values(array_diff(range(0, 6), [\Illuminate\Support\Carbon::parse($date)->dayOfWeek]));
        ShopHoursSetting::set('schedule.hotel', $hotelSchedule);
        $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$hotelServiceId}")
            ->assertOk()
            ->assertJsonCount(0, 'data.slots')
            ->assertJsonPath('data.reason', 'closed');
    }

    public function test_hotel_booking_rejects_a_check_in_time_outside_configured_hourly_slots(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');

        $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'small',
            'pet_size' => 'Small',
            'appointment_date' => now('Asia/Manila')->addDays(5)->toDateString(),
            'start_time' => '08:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'reservation_channel' => 'cash',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'The selected check-in time is no longer available. Please choose an available Hotel Suite time.');
    }

    public function test_admin_daycare_requires_top_level_duration(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('daycare');
        $this->createServiceTier($serviceId, 'medium', 450.00);

        $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => now('Asia/Manila')->addDays(2)->toDateString(),
            'start_time' => '09:00:00',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Duration tier selection is required for daycare bookings. Please select Hourly, Half Day, or Full Day.');
    }

    public function test_customer_daycare_is_pending_and_persists_duration(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner($customer->id);
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        $this->createPetAssessment($petId, $ownerId);
        $serviceId = $this->createService('daycare');
        $this->createServiceTier($serviceId, 'medium', 450.00);
        Sanctum::actingAs($customer);

        $this->postJson('/api/my-appointments', [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => now('Asia/Manila')->addDays(2)->toDateString(),
            'start_time' => '09:00:00',
            'daycare_duration' => 'half_day',
            'daycare_pet_sizes' => [['pet_id' => $petId, 'size_label' => 'medium']],
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.daycare_duration', 'half_day');
    }

    public function test_admin_can_edit_daycare_duration_and_size_while_approved(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('daycare');
        $this->createServiceTier($serviceId, 'medium', 450.00);
        $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);

        $appointment = Appointment::query()->latest('created_at')->firstOrFail();
        $appointment->update([
            'appointment_date' => now('Asia/Manila')->addDays(2)->toDateString(),
            'start_time' => '09:00:00',
            'status' => 'approved',
            'daycare_duration' => 'hourly',
            'size_label' => 'small',
        ]);

        $this->putJson("/api/appointments/{$appointment->id}", [
            'service_id' => $serviceId,
            'appointment_date' => $appointment->appointment_date->toDateString(),
            'start_time' => '09:00:00',
            'daycare_duration' => 'half_day',
            'size_label' => 'medium',
        ])->assertOk()
            ->assertJsonPath('data.daycare_duration', 'half_day')
            ->assertJsonPath('data.size_label', 'medium');
    }

    public function test_hotel_booking_rejects_missing_suite_and_nights(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');

        $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'pet_size' => 'Small',
            'appointment_date' => now('Asia/Manila')->addDays(2)->toDateString(),
            'start_time' => '09:00:00',
            'reference_number' => 'REF123',
            'reservation_channel' => 'e_wallet',
            'reservation_payment_account_id' => 'gcash-main',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Hotel reservations require a suite and number of nights.');
    }

    public function test_customer_hotel_booking_is_pending_with_hold_and_server_deposit(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner($customer->id);
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        $this->createPetAssessment($petId, $ownerId);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');
        Sanctum::actingAs($customer);

        $response = $this->postJson('/api/my-appointments', [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'size_label' => 'small',
            'pet_size' => 'Small',
            'appointment_date' => now('Asia/Manila')->addDays(3)->toDateString(),
            'start_time' => '09:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 2,
            'reference_number' => 'HOTEL123',
            'reservation_channel' => 'e_wallet',
            'reservation_payment_account_id' => 'gcash-main',
            'deposit' => 1,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.pet_size', 'Small')
            ->assertJsonPath('data.deposit', 650)
            ->assertJsonPath('data.reservation_payment_account_id', 'gcash-main')
            ->assertJsonPath('data.reservation_payer_provider', null);
        $this->assertNotNull($response->json('data.capacity_hold_expires_at'));

        $appointmentId = $response->json('data.id');
        $this->getJson("/api/my-appointments/{$appointmentId}")
            ->assertOk()
            ->assertJsonPath('data.pet_size', 'Small')
            ->assertJsonPath('data.reservation_payment_account_id', 'gcash-main')
            ->assertJsonPath('data.reservation_payer_provider', null);
    }

    public function test_customer_appointment_history_includes_stored_groomer_name(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner($customer->id);
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        $groomer = $this->createStaffUser('groomer', 'history-groomer');
        $serviceId = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId, $groomer->id, $ownerId);

        Appointment::query()->whereKey($appointmentId)->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
        $groomer->update(['is_active' => false]);

        Sanctum::actingAs($customer);

        $this->getJson('/api/my-appointments?per_page=100')
            ->assertOk()
            ->assertJsonPath('data.data.0.handled_by_name', $groomer->name)
            ->assertJsonMissingPath('data.data.0.handled_by')
            ->assertJsonMissingPath('data.data.0.handled_by.email');

        $this->postJson('/api/powersync/sync')
            ->assertOk()
            ->assertJsonPath('data.data.appointments.0.handled_by_name', $groomer->name)
            ->assertJsonMissingPath('data.data.appointments.0.handled_by');
    }

    public function test_admin_hotel_payment_to_and_payment_from_are_stored_separately(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');

        $response = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'small',
            'pet_size' => 'Small',
            'appointment_date' => now('Asia/Manila')->addDays(4)->toDateString(),
            'start_time' => '10:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'reference_number' => 'ADMINHOTEL1',
            'reservation_channel' => 'e_wallet',
            'reservation_payment_account_id' => 'gcash-main',
            'reservation_payer_provider' => 'Maya',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.pet_size', 'Small')
            ->assertJsonPath('data.reservation_payment_account_id', 'gcash-main')
            ->assertJsonPath('data.reservation_payer_provider', 'Maya')
            ->assertJsonPath('data.reservation_provider', null);

        $appointmentId = $response->json('data.id');
        $this->getJson("/api/appointments/{$appointmentId}")
            ->assertOk()
            ->assertJsonPath('data.pet_size', 'Small')
            ->assertJsonPath('data.reservation_payment_account_id', 'gcash-main')
            ->assertJsonPath('data.reservation_payer_provider', 'Maya');
    }

    public function test_hotel_booking_rejects_missing_pet_size(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');

        $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'XS to Small',
            'appointment_date' => now('Asia/Manila')->addDays(5)->toDateString(),
            'start_time' => '10:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'reservation_channel' => 'cash',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Select a valid Pet Size for the selected pet before booking the hotel suite.');
    }

    public function test_legacy_hotel_appointment_without_pet_size_remains_readable(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $appointmentId = $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);

        $this->getJson("/api/appointments/{$appointmentId}")
            ->assertOk()
            ->assertJsonPath('data.pet_size', null);
    }

    public function test_cat_hotel_booking_accepts_cat_size_without_dog_categories(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $catSpeciesId = $this->createSpeciesType('Cat', 'C');
        $catBreedId = $this->createBreed($catSpeciesId, 'Domestic Shorthair');
        $catPetId = $this->createPet($this->ownerId, $catSpeciesId, $catBreedId);
        $this->createPetAssessment($catPetId, $this->ownerId);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Whiskers')->value('id');

        $response = $this->postJson('/api/appointments', [
            'pet_id' => $catPetId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'XS to Small',
            'pet_size' => 'KITTEN',
            'appointment_date' => now('Asia/Manila')->addDays(6)->toDateString(),
            'start_time' => '10:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'reservation_channel' => 'cash',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.pet_size', 'KITTEN');
    }

    public function test_changing_hotel_pet_size_preserves_the_saved_reservation_price(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $suiteId = DB::table('hotel_suites')->where('name', 'The Cozy Paw Suite')->value('id');

        $response = $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'XS to Small',
            'pet_size' => 'Small',
            'appointment_date' => now('Asia/Manila')->addDays(7)->toDateString(),
            'start_time' => '10:00:00',
            'hotel_suite_id' => $suiteId,
            'hotel_nights' => 1,
            'reservation_channel' => 'cash',
        ])->assertCreated();

        $appointmentId = $response->json('data.id');
        $originalPrice = (float) $response->json('data.total_price');

        $updated = $this->putJson("/api/appointments/{$appointmentId}", [
            'pet_size' => 'Large',
        ])->assertOk()
            ->assertJsonPath('data.pet_size', 'Large');

        $this->assertEquals($originalPrice, (float) $updated->json('data.total_price'));
    }

    public function test_legacy_reservation_provider_remains_ambiguous_and_is_not_backfilled(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $serviceId = $this->createService('hotel');
        $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);

        $appointment = Appointment::query()->latest('created_at')->firstOrFail();
        $appointment->update([
            'reservation_channel' => 'e_wallet',
            'reservation_provider' => 'GCash',
        ]);

        $this->getJson("/api/appointments/{$appointment->id}")
            ->assertOk()
            ->assertJsonPath('data.reservation_provider', 'GCash')
            ->assertJsonPath('data.reservation_payment_account_id', null)
            ->assertJsonPath('data.reservation_payer_provider', null);
    }

    public function test_daycare_overlapping_duration_is_blocked_for_another_owner(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('daycare');
        $this->createServiceTier($serviceId, 'medium', 450.00);
        $date = now('Asia/Manila')->addDays(4)->toDateString();

        $this->postJson('/api/appointments', [
            'pet_id' => $this->petId,
            'booked_by_owner_id' => $this->ownerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => $date,
            'start_time' => '09:00:00',
            'daycare_duration' => 'full_day',
        ])->assertCreated();

        $otherOwnerId = $this->createOwner();
        $otherPetId = $this->createPet($otherOwnerId, $this->speciesId, $this->breedId);
        $this->createPetAssessment($otherPetId, $otherOwnerId);

        $this->postJson('/api/appointments', [
            'pet_id' => $otherPetId,
            'booked_by_owner_id' => $otherOwnerId,
            'service_id' => $serviceId,
            'size_label' => 'medium',
            'appointment_date' => $date,
            'start_time' => '10:00:00',
            'daycare_duration' => 'hourly',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'This daycare time range is reserved by another client.');
    }

    public function test_daycare_available_slots_hide_overlapping_duration(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $serviceId = $this->createService('daycare');
        $this->createServiceTier($serviceId, 'medium', 450.00);
        $date = now('Asia/Manila')->addDays(4)->toDateString();

        $this->createAppointment($this->petId, $serviceId, $admin->id, $this->ownerId);
        Appointment::query()->latest('created_at')->firstOrFail()->update([
            'appointment_date' => $date,
            'start_time' => '09:00:00',
            'status' => 'pending',
            'daycare_duration' => 'full_day',
        ]);

        $response = $this->getJson("/api/appointments/available-slots?date={$date}&service_id={$serviceId}&duration_tier=hourly");

        $response->assertOk();
        $this->assertNotContains('10:00:00', $response->json('data.slots'));
    }
}
