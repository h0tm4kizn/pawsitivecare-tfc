<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\CommissionSetting;
use App\Models\ShopHoursSetting;
use App\Models\StaffAttendance;
use App\Models\StaffCommission;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class StaffOperationsTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_staff_can_time_in_and_out_once_per_active_record(): void
    {
        $staff = $this->createStaffUser();
        Sanctum::actingAs($staff);

        $this->postJson('/api/staff/attendance/time-in')->assertCreated();
        $this->postJson('/api/staff/attendance/time-in')->assertUnprocessable();
        $this->postJson('/api/staff/attendance/time-out')->assertOk();
        $this->postJson('/api/staff/attendance/time-out')->assertUnprocessable();

        $this->getJson('/api/staff/attendance/history')->assertOk()->assertJsonCount(1, 'data.data');
    }

    public function test_admin_qr_attendance_validates_rotatable_credentials_and_uses_existing_records(): void
    {
        $staff = $this->createStaffUser('field');
        $staff->update(['display_id' => 'STF260501']);
        $admin = $this->createAdminUser();
        $this->assertNotEmpty($staff->display_id);
        Sanctum::actingAs($admin);

        $credentialResponse = $this->postJson("/api/admin/staff/{$staff->id}/qr-credential")->assertOk();
        $credential = $credentialResponse->json('data.credential');
        $this->assertIsString($credential);
        $this->assertSame($staff->display_id, json_decode($credential, true, 8, JSON_THROW_ON_ERROR)['staff_id']);
        $encryptedCredential = $staff->fresh()->getRawOriginal('qr_credential');
        $this->assertNotEmpty($encryptedCredential);
        $this->assertNotSame($credential, $encryptedCredential);

        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $staff->display_id])
            ->assertUnprocessable();
        $identified = $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $credential])
            ->assertOk()
            ->assertJsonPath('data.staff.id', $staff->id)
            ->assertJsonPath('data.staff.display_id', $staff->display_id)
            ->assertJsonPath('data.next_action', 'time_in');

        $this->postJson('/api/admin/attendance/qr/confirm-time-in', ['credential' => $credential])->assertCreated();
        $attendance = StaffAttendance::query()->where('staff_id', $staff->id)->sole();
        $this->assertSame($admin->id, $attendance->recorded_by);
        $this->assertSame('qr_admin', $attendance->recording_method);
        $this->postJson('/api/admin/attendance/qr/confirm-time-in', ['credential' => $credential])->assertUnprocessable();
        $this->assertSame(1, StaffAttendance::query()->where('staff_id', $staff->id)->count());

        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $credential])
            ->assertOk()
            ->assertJsonPath('data.next_action', 'time_out');
        $this->postJson('/api/admin/attendance/qr/confirm-time-out', ['credential' => $credential])->assertOk();

        $newCredential = $this->postJson("/api/admin/staff/{$staff->id}/qr-credential/reissue")
            ->assertOk()
            ->json('data.credential');
        $this->assertNotSame($credential, $newCredential);
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $credential])->assertUnprocessable();
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $newCredential])->assertOk();

        $staff->update(['is_active' => false]);
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $newCredential])->assertUnprocessable();
    }

    public function test_qr_identification_routes_overnight_open_shifts_to_admin_review(): void
    {
        $staff = $this->createStaffUser('field');
        $staff->update(['display_id' => 'STF260503']);
        $admin = $this->createAdminUser();
        $timeIn = Carbon::create(2026, 10, 8, 9, 0, 0, 'Asia/Manila');
        Carbon::setTestNow(Carbon::create(2026, 10, 9, 9, 0, 0, 'Asia/Manila'));
        ShopHoursSetting::set('shop_hours_raw', ['thu' => ['closed' => false, 'close' => '18:00']]);
        StaffAttendance::create([
            'staff_id' => $staff->id,
            'time_in_at' => $timeIn,
            'timezone' => 'Asia/Manila',
        ]);

        Sanctum::actingAs($admin);
        $credential = $this->postJson("/api/admin/staff/{$staff->id}/qr-credential")
            ->assertOk()
            ->json('data.credential');

        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => $credential])
            ->assertOk()
            ->assertJsonPath('data.attendance_state.status', 'missing_time_out')
            ->assertJsonPath('data.next_action', 'needs_review');
        $this->postJson('/api/admin/attendance/qr/confirm-time-out', ['credential' => $credential])
            ->assertUnprocessable();
        $this->assertDatabaseHas('staff_attendance', [
            'staff_id' => $staff->id,
            'time_out_at' => null,
        ]);
        Carbon::setTestNow();
    }

    public function test_staff_and_customers_cannot_use_admin_qr_attendance_endpoints(): void
    {
        $staff = $this->createStaffUser();
        $staff->update(['display_id' => 'STF260502']);
        Sanctum::actingAs($staff);
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => 'forged'])->assertForbidden();
        $this->postJson('/api/admin/attendance/qr/confirm-time-in', ['credential' => 'forged'])->assertForbidden();
        $this->postJson('/api/staff/qr-credential')->assertOk();

        Sanctum::actingAs($this->createCustomerUser());
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => 'forged'])->assertForbidden();
        $this->postJson('/api/staff/qr-credential')->assertForbidden();
    }

    public function test_guests_cannot_use_qr_attendance_or_staff_credential_endpoints(): void
    {
        $this->postJson('/api/admin/attendance/qr/identify', ['credential' => 'forged'])->assertUnauthorized();
        $this->postJson('/api/admin/attendance/qr/confirm-time-in', ['credential' => 'forged'])->assertUnauthorized();
        $this->postJson('/api/staff/qr-credential')->assertUnauthorized();
    }

    public function test_customer_cannot_access_staff_operations(): void
    {
        Sanctum::actingAs($this->createCustomerUser());
        $this->getJson('/api/staff/attendance/today')->assertForbidden();
        $this->getJson('/api/staff/commissions')->assertForbidden();
    }

    public function test_admin_staff_activity_routes_cover_attendance_and_commissions_for_selected_staff(): void
    {
        $staff = $this->createStaffUser('groomer');
        $admin = $this->createAdminUser();
        $ownerUser = $this->createCustomerUser();
        $ownerId = $this->createOwner($ownerUser->id);
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId, $staff->id, $ownerId);

        Appointment::query()->whereKey($appointmentId)->update([
            'status' => 'completed',
            'total_price' => 800,
            'completed_at' => now('Asia/Manila'),
        ]);
        CommissionSetting::create([
            'service_category' => 'grooming',
            'rate_percent' => 10,
            'calculation_basis' => 'final_service_price',
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/staff?per_page=100')->assertOk();
        $this->getJson("/api/admin/attendance/today?staff_id={$staff->id}")->assertOk();
        $this->getJson("/api/admin/attendance?staff_id={$staff->id}&per_page=5")->assertOk();
        $this->getJson("/api/admin/commissions?staff_id={$staff->id}&per_page=5")
            ->assertOk()
            ->assertJsonCount(0, 'data.data');
        $this->getJson("/api/admin/commissions/available-appointments?staff_id={$staff->id}")
            ->assertOk()
            ->assertJsonPath('data.0.id', $appointmentId);

        $this->postJson("/api/admin/attendance/{$staff->id}/time-in")->assertCreated();
        $this->postJson("/api/admin/attendance/{$staff->id}/time-out")->assertOk();
        $this->postJson('/api/admin/commissions', [
            'staff_id' => $staff->id,
            'appointment_id' => $appointmentId,
            'rate_percent' => 10,
            'service_amount' => 800,
        ])->assertCreated();
        $this->getJson("/api/admin/commissions?staff_id={$staff->id}&per_page=5")
            ->assertOk()
            ->assertJsonPath('data.data.0.staff.id', $staff->id);
    }

    public function test_completed_appointment_creates_rate_snapshot_only_once(): void
    {
        $staff = $this->createStaffUser('groomer');
        $ownerUser = $this->createCustomerUser();
        $ownerId = $this->createOwner($ownerUser->id);
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId, $staff->id, $ownerId);

        Appointment::query()->whereKey($appointmentId)->update([
            'status' => 'completed',
            'total_price' => 800,
            'completed_at' => now('Asia/Manila'),
        ]);
        CommissionSetting::create([
            'service_category' => 'grooming',
            'rate_percent' => 10,
            'calculation_basis' => 'final_service_price',
            'is_active' => true,
            'created_by' => $this->createAdminUser()->id,
        ]);

        $appointment = Appointment::findOrFail($appointmentId);
        app(\App\Services\StaffCommissionService::class)->earnForCompletedAppointment($appointment);
        app(\App\Services\StaffCommissionService::class)->earnForCompletedAppointment($appointment->fresh());

        $this->assertDatabaseHas('staff_commissions', [
            'appointment_id' => $appointmentId,
            'rate_percent' => 10,
            'commission_amount' => 80,
        ]);
        $this->assertSame(1, StaffCommission::where('appointment_id', $appointmentId)->count());
    }

    public function test_completing_an_assigned_appointment_creates_commission_automatically(): void
    {
        $staff = $this->createStaffUser('groomer');
        $admin = $this->createAdminUser();
        $ownerUser = $this->createCustomerUser();
        $ownerId = $this->createOwner($ownerUser->id);
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId, $staff->id, $ownerId);
        Appointment::query()->whereKey($appointmentId)->update(['appointment_date' => now('Asia/Manila')->toDateString(), 'total_price' => 800]);
        CommissionSetting::create([
            'service_category' => 'grooming',
            'rate_percent' => 10,
            'calculation_basis' => 'final_service_price',
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'approved'])->assertOk();
        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'in_progress'])->assertOk();
        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'completed'])->assertOk();

        $this->assertDatabaseHas('staff_commissions', [
            'appointment_id' => $appointmentId,
            'staff_id' => $staff->id,
            'commission_base_amount' => 800,
            'rate_percent' => 10,
            'commission_amount' => 80,
        ]);
    }

    public function test_manual_eligibility_returns_authoritative_base_and_rate_only_for_eligible_appointments(): void
    {
        $staff = $this->createStaffUser('groomer');
        $admin = $this->createAdminUser();
        $ownerUser = $this->createCustomerUser();
        $ownerId = $this->createOwner($ownerUser->id);
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $eligibleId = $this->createAppointment($petId, $serviceId, $staff->id, $ownerId);
        $ineligibleId = $this->createAppointment($petId, $serviceId, $staff->id, $ownerId);
        Appointment::query()->whereIn('id', [$eligibleId, $ineligibleId])->update([
            'status' => 'completed',
            'total_price' => 800,
            'completed_at' => now('Asia/Manila'),
        ]);
        CommissionSetting::create([
            'service_category' => 'grooming',
            'rate_percent' => 10,
            'calculation_basis' => 'final_service_price',
            'is_active' => true,
            'created_by' => $admin->id,
        ]);
        StaffCommission::create([
            'staff_id' => $staff->id,
            'appointment_id' => $ineligibleId,
            'service_id' => $serviceId,
            'service_amount' => 800,
            'commission_base_amount' => 800,
            'rate_percent' => 10,
            'commission_amount' => 80,
            'calculation_basis' => 'manual_adjustment',
            'earned_at' => now('Asia/Manila'),
        ]);

        Sanctum::actingAs($admin);
        $response = $this->getJson("/api/admin/commissions/available-appointments?staff_id={$staff->id}")->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $eligibleId);
        $response->assertJsonPath('data.0.commission_base_amount', 800);
        $response->assertJsonPath('data.0.effective_rate_percent', 10);
    }

    public function test_new_grooming_assignment_requires_an_on_duty_groomer(): void
    {
        $admin = $this->createAdminUser();
        $onDutyGroomer = $this->createStaffUser('groomer', 'on-duty');
        $offDutyGroomer = $this->createStaffUser('groomer', 'off-duty');
        $front_deskStaff = $this->createStaffUser('front_desk', 'front_desk');
        StaffAttendance::create([
            'staff_id' => $onDutyGroomer->id,
            'time_in_at' => now('Asia/Manila'),
            'timezone' => 'Asia/Manila',
        ]);

        $owner = $this->createOwner();
        $species = $this->createSpeciesType();
        $pet = $this->createPet($owner, $species, $this->createBreed($species));
        $service = $this->createService('grooming');
        $appointmentId = $this->createAppointment($pet, $service, null, $owner);
        Appointment::query()->whereKey($appointmentId)->update([
            'status' => 'in_progress',
            'appointment_date' => now('Asia/Manila')->toDateString(),
        ]);

        Sanctum::actingAs($admin);
        $options = $this->getJson('/api/admin/staff?type=groomer&availability=on_duty&per_page=100')->assertOk();
        $this->assertContains($onDutyGroomer->id, array_column($options->json('data.data'), 'id'));
        $this->assertNotContains($offDutyGroomer->id, array_column($options->json('data.data'), 'id'));
        $this->assertNotContains($front_deskStaff->id, array_column($options->json('data.data'), 'id'));

        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'completed',
            'handled_by' => $offDutyGroomer->id,
        ])->assertUnprocessable();
        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'completed',
            'handled_by' => $front_deskStaff->id,
        ])->assertUnprocessable();
        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'completed',
            'handled_by' => $onDutyGroomer->id,
        ])->assertOk();
    }

    public function test_timed_out_groomer_remains_on_completed_assignment_and_commission(): void
    {
        $admin = $this->createAdminUser();
        $groomer = $this->createStaffUser('groomer', 'history');
        $attendance = StaffAttendance::create([
            'staff_id' => $groomer->id,
            'time_in_at' => now('Asia/Manila')->subHour(),
            'timezone' => 'Asia/Manila',
        ]);
        $owner = $this->createOwner();
        $species = $this->createSpeciesType();
        $pet = $this->createPet($owner, $species, $this->createBreed($species));
        $service = $this->createService('grooming');
        $appointmentId = $this->createAppointment($pet, $service, $groomer->id, $owner);
        Appointment::query()->whereKey($appointmentId)->update([
            'status' => 'in_progress',
            'appointment_date' => now('Asia/Manila')->toDateString(),
            'total_price' => 800,
        ]);
        $attendance->update(['time_out_at' => now('Asia/Manila')]);
        CommissionSetting::create([
            'service_category' => 'grooming',
            'rate_percent' => 12.5,
            'calculation_basis' => 'final_service_price',
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/appointments/{$appointmentId}/status", ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('data.handled_by', $groomer->id);
        $this->assertDatabaseHas('staff_commissions', [
            'appointment_id' => $appointmentId,
            'staff_id' => $groomer->id,
            'rate_percent' => 12.5,
            'commission_amount' => 100,
        ]);
    }

    public function test_stale_open_attendance_requires_admin_correction_without_auto_timeout(): void
    {
        $staff = $this->createStaffUser('groomer');
        $admin = $this->createAdminUser();
        $timeIn = Carbon::create(2026, 10, 8, 9, 2, 0, 'Asia/Manila');
        Carbon::setTestNow(Carbon::create(2026, 10, 8, 19, 1, 0, 'Asia/Manila'));
        ShopHoursSetting::set('shop_hours_raw', ['thu' => ['closed' => false, 'close' => '18:00']]);
        $attendance = StaffAttendance::create([
            'staff_id' => $staff->id,
            'time_in_at' => $timeIn,
            'timezone' => 'Asia/Manila',
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/admin/attendance/today?staff_id={$staff->id}")
            ->assertOk()
            ->assertJsonPath('attendance_state.status', 'missing_time_out')
            ->assertJsonPath('can_self_time_out', true);
        $this->getJson('/api/admin/attendance/summary')
            ->assertOk()
            ->assertJsonPath('data.count', 0)
            ->assertJsonPath('data.needs_review_count', 1);

        $this->patchJson("/api/admin/attendance/{$attendance->id}/correct-time-out", [
            'time_out_at' => '2026-10-08T08:30',
            'reason' => 'Forgot to clock out',
        ])->assertUnprocessable();
        $this->assertDatabaseHas('staff_attendance', ['id' => $attendance->id, 'time_out_at' => null]);

        $this->patchJson("/api/admin/attendance/{$attendance->id}/correct-time-out", [
            'time_out_at' => '2026-10-08T18:08',
            'reason' => 'Forgot to clock out',
        ])->assertOk();
        $this->assertDatabaseMissing('staff_attendance', ['id' => $attendance->id, 'time_out_at' => null]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'attendance_corrected']);
        Carbon::setTestNow();
    }
}
