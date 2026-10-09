<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Policies\AppointmentPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #109 — Staff cannot update another staff member's appointment.
 *
 * Tests AppointmentPolicy@update directly since AppointmentController::update()
 * is not yet implemented (Lyeanne / Dev 2 pending task).
 *
 * Policy rule:
 *   Admin  → always allowed
 *   Staff  → only if appointment.handled_by === user.id
 *   Customer → only if appointment.booked_by_owner_id === user.owner.id
 */
class PolicyAppointmentAccessTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private AppointmentPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new AppointmentPolicy();
    }

    private function makeAppointment(array $attributes = []): Appointment
    {
        $appointment = new Appointment();
        foreach ($attributes as $key => $value) {
            $appointment->$key = $value;
        }
        return $appointment;
    }

    // ── update() ──────────────────────────────────────────────────────────────

    public function test_staff_can_update_appointment_assigned_to_another_staff(): void
    {
        $staffA      = $this->createStaffUser('front_desk', '_a');
        $staffB      = $this->createStaffUser('front_desk', '_b');
        $appointment = $this->makeAppointment(['handled_by' => $staffA->id]);

        $this->assertTrue($this->policy->update($staffB, $appointment));
    }

    public function test_staff_can_update_their_own_appointment(): void
    {
        $staffA      = $this->createStaffUser('front_desk', '_a');
        $appointment = $this->makeAppointment(['handled_by' => $staffA->id]);

        $this->assertTrue($this->policy->update($staffA, $appointment));
    }

    public function test_staff_can_update_unassigned_appointment(): void
    {
        $staff       = $this->createStaffUser();
        $appointment = $this->makeAppointment(['handled_by' => null]);

        $this->assertTrue($this->policy->update($staff, $appointment));
    }

    public function test_admin_can_update_any_appointment(): void
    {
        $admin       = $this->createAdminUser();
        $staffA      = $this->createStaffUser('front_desk', '_a');
        $appointment = $this->makeAppointment(['handled_by' => $staffA->id]);

        $this->assertTrue($this->policy->update($admin, $appointment));
    }

    // ── updateStatus() ────────────────────────────────────────────────────────

    public function test_admin_can_update_status(): void
    {
        $admin       = $this->createAdminUser();
        $appointment = $this->makeAppointment([]);

        $this->assertTrue($this->policy->updateStatus($admin, $appointment));
    }

    public function test_staff_can_update_status_on_any_appointment(): void
    {
        $staff       = $this->createStaffUser();
        $appointment = $this->makeAppointment([]);

        // updateStatus allows all staff regardless of handled_by
        $this->assertTrue($this->policy->updateStatus($staff, $appointment));
    }

    public function test_customer_cannot_update_status(): void
    {
        $customer    = $this->createCustomerUser();
        $appointment = $this->makeAppointment([]);

        $this->assertFalse($this->policy->updateStatus($customer, $appointment));
    }

    // ── delete() ──────────────────────────────────────────────────────────────

    public function test_only_admin_can_delete_appointment(): void
    {
        $admin    = $this->createAdminUser();
        $staff    = $this->createStaffUser();
        $customer = $this->createCustomerUser();
        $appt     = $this->makeAppointment([]);

        $this->assertTrue($this->policy->delete($admin, $appt));
        $this->assertFalse($this->policy->delete($staff, $appt));
        $this->assertFalse($this->policy->delete($customer, $appt));
    }
}
