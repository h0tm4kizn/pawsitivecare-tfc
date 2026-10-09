<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #105 — Pet CRUD authorization tests.
 * Task #110a — DOB future date rejection.
 *
 * - Admin and staff can create pets
 * - Customer cannot create pets
 * - Admin can delete pets
 * - Staff cannot delete pets
 * - Future DOB is rejected with 422
 */
class PetCrudTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private string $speciesId;
    private string $breedId;
    private string $ownerId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->speciesId = $this->createSpeciesType();
        $this->breedId   = $this->createBreed($this->speciesId);
        $this->ownerId   = $this->createOwner();
    }

    private function petPayload(array $overrides = []): array
    {
        return array_merge([
            'owner_id'      => $this->ownerId,
            'species_id'    => $this->speciesId,
            'breed_id'      => $this->breedId,
            'name'          => 'Buddy',
            'sex'           => 'male',
            'date_of_birth' => '2020-06-15',
            'weight_kg'     => 12.5,
        ], $overrides);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_admin_can_create_pet(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/pets', $this->petPayload());

        $response->assertStatus(201)
                 ->assertJsonPath('status', 201);
    }

    public function test_staff_can_create_pet(): void
    {
        $staff = $this->createStaffUser();
        Sanctum::actingAs($staff);

        $response = $this->postJson('/api/pets', $this->petPayload());

        $response->assertStatus(201)
                 ->assertJsonPath('status', 201);
    }

    public function test_customer_cannot_create_pet(): void
    {
        $customer = $this->createCustomerUser();
        Sanctum::actingAs($customer);

        $response = $this->postJson('/api/pets', $this->petPayload());

        // StorePetRequest authorize() returns false for customers → 403
        $response->assertStatus(403);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public function test_admin_can_list_all_pets(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/pets');

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);
    }

    public function test_customer_only_sees_their_own_pets(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId  = $this->createOwner($customer->id);

        // Pet belonging to this customer
        $this->createPet($ownerId, $this->speciesId, $this->breedId);

        // Pet belonging to a different owner (should not be visible)
        $otherOwner = $this->createOwner();
        $this->createPet($otherOwner, $this->speciesId, $this->breedId);

        Sanctum::actingAs($customer);
        $response = $this->getJson('/api/my-pets');

        $response->assertStatus(200);
        // Customer's owner has 1 pet — the other owner's pet should not appear
        $this->assertCount(1, $response->json('data'));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_admin_can_delete_pet(): void
    {
        $admin = $this->createAdminUser();
        $petId = $this->createPet($this->ownerId, $this->speciesId, $this->breedId);
        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/pets/{$petId}", ['action_reason' => 'Test cleanup']);

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);

        $this->assertSoftDeleted('pets', ['id' => $petId]);
    }

    public function test_staff_cannot_delete_pet(): void
    {
        $staff = $this->createStaffUser();
        $petId = $this->createPet($this->ownerId, $this->speciesId, $this->breedId);
        Sanctum::actingAs($staff);

        $response = $this->deleteJson("/api/pets/{$petId}");

        $response->assertStatus(403);

        $this->assertDatabaseHas('pets', ['id' => $petId]);
    }

    // ── Task #110a — DOB Validation ───────────────────────────────────────────

    public function test_future_date_of_birth_is_rejected(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/pets', $this->petPayload([
            'date_of_birth' => now()->addDay()->toDateString(),
        ]));

        $response->assertStatus(422)
                 ->assertJsonValidationErrorFor('date_of_birth');
    }

    public function test_todays_date_of_birth_is_accepted(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/pets', $this->petPayload([
            'date_of_birth' => now()->toDateString(),
        ]));

        $response->assertStatus(201);
    }

    public function test_past_date_of_birth_is_accepted(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/pets', $this->petPayload([
            'date_of_birth' => '2019-03-15',
        ]));

        $response->assertStatus(201);
    }
}
