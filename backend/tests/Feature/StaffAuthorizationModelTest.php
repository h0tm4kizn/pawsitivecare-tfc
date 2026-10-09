<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class StaffAuthorizationModelTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_front_desk_has_operational_access_but_not_admin_surfaces(): void
    {
        $frontDesk = $this->createStaffUser('front_desk');
        Sanctum::actingAs($frontDesk);

        $this->getJson('/api/owners')->assertOk();
        $this->getJson('/api/appointments')->assertOk();
        $this->getJson('/api/admin/walk-in-sales')->assertOk();
        $this->getJson('/api/reports/appointment-summary')->assertForbidden();
        $this->getJson('/api/staff/commissions')->assertForbidden();
    }

    public function test_groomer_cannot_browse_customer_or_retail_surfaces(): void
    {
        $groomer = $this->createStaffUser('groomer');
        Sanctum::actingAs($groomer);

        $this->getJson('/api/owners')->assertForbidden();
        $this->getJson('/api/pets')->assertForbidden();
        $this->getJson('/api/admin/walk-in-sales')->assertForbidden();
        $this->getJson('/api/scan-sessions/server-ip')->assertForbidden();
        $this->getJson('/api/reports/appointment-summary')->assertForbidden();
        $this->getJson('/api/staff/commissions')->assertOk();
        $this->getJson('/api/appointments')->assertOk();
    }

    public function test_groomer_can_only_update_status_for_an_assigned_grooming_appointment(): void
    {
        $groomer = $this->createStaffUser('groomer');
        $otherGroomer = $this->createStaffUser('groomer', '_other');
        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $assignedId = $this->createAppointment($petId, $serviceId, $groomer->id, $ownerId);
        $unassignedId = $this->createAppointment($petId, $serviceId, $otherGroomer->id, $ownerId);

        Sanctum::actingAs($groomer);
        $this->getJson('/api/appointments')->assertJsonCount(1, 'data.data');
        $this->patchJson("/api/appointments/{$unassignedId}/status", ['status' => 'in_progress'])->assertForbidden();
        $this->patchJson("/api/appointments/{$assignedId}/status", ['status' => 'approved'])->assertForbidden();
    }
}
