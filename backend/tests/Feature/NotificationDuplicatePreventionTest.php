<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #110 — Notification double-send prevention.
 * Fixed March 26, 2026: removed v1 column names (full_name, scheduled_at, service_tier_id).
 */
class NotificationDuplicatePreventionTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_it_blocks_duplicate_notification_for_same_owner_appointment_type_and_channel(): void
    {
        $staffUser = $this->createStaffUser('front_desk');
        Sanctum::actingAs($staffUser);

        $speciesId     = $this->createSpeciesType('Dog', 'D');
        $breedId       = $this->createBreed($speciesId, 'Aspin');
        $ownerId       = $this->createOwner();
        $petId         = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId     = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId);

        $payload = [
            'owner_id'       => $ownerId,
            'appointment_id' => $appointmentId,
            'message'        => 'Appointment reminder',
            'channel'        => 'phone',
            'type'           => 'confirmation',
        ];

        $firstResponse = $this->postJson('/api/notifications', $payload);
        $firstResponse
            ->assertStatus(201)
            ->assertJsonPath('status', 201);

        $secondResponse = $this->postJson('/api/notifications', $payload);
        $secondResponse
            ->assertStatus(409)
            ->assertJsonPath('status', 409);

        $this->assertDatabaseCount('notifications', 1);
    }
}
