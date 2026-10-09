<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class PetHealthFormOwnerAccessTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private string $speciesId;
    private string $breedId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->speciesId = $this->createSpeciesType();
        $this->breedId = $this->createBreed($this->speciesId);
    }

    private function assessmentPayload(array $overrides = []): array
    {
        return array_merge([
            'weight_kg' => '10.00',
            'is_vaccinated' => 'No',
            'is_friendly' => 'socialize',
            'treat_preference' => 'can_treats',
            'declaration_accepted' => true,
            'medical_conditions' => 'None',
        ], $overrides);
    }

    public function test_customer_can_read_and_update_their_assessment_without_creating_a_duplicate(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner($customer->id);
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        DB::table('pet_assessment_form')->insert([
            'id' => (string) Str::uuid(),
            'pet_id' => $petId,
            'owner_id' => $ownerId,
            'is_vaccinated' => 'No',
            'medical_conditions' => 'Initial answer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Sanctum::actingAs($customer);

        $this->getJson("/api/my-pets/{$petId}/health-form")
            ->assertOk()
            ->assertJsonPath('data.medical_conditions', 'Initial answer');

        $this->postJson("/api/my-pets/{$petId}/health-form", $this->assessmentPayload([
            'medical_conditions' => 'Updated answer',
        ]))
            ->assertOk()
            ->assertJsonPath('data.medical_conditions', 'Updated answer');

        $this->getJson("/api/my-pets/{$petId}/health-form")
            ->assertOk()
            ->assertJsonPath('data.medical_conditions', 'Updated answer');

        $this->assertDatabaseCount('pet_assessment_form', 1);
        $this->assertDatabaseHas('pet_assessment_form', [
            'pet_id' => $petId,
            'medical_conditions' => 'Updated answer',
        ]);
    }

    public function test_customer_can_read_and_create_their_assessment_when_owner_link_uses_email_fallback(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner();
        DB::table('owners')->where('id', $ownerId)->update(['email' => $customer->email]);
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        Sanctum::actingAs($customer);

        $this->getJson("/api/my-pets/{$petId}/health-form")
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->postJson("/api/my-pets/{$petId}/health-form", $this->assessmentPayload())
            ->assertOk()
            ->assertJsonPath('data.pet_id', $petId);
    }

    public function test_customer_cannot_read_or_update_another_owners_assessment(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId = $this->createOwner();
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);
        Sanctum::actingAs($customer);

        $this->getJson("/api/my-pets/{$petId}/health-form")->assertForbidden();
        $this->postJson("/api/my-pets/{$petId}/health-form", $this->assessmentPayload())->assertForbidden();

        $this->assertDatabaseCount('pet_assessment_form', 0);
    }

    public function test_admin_and_front_desk_staff_can_still_save_assessments(): void
    {
        $ownerId = $this->createOwner();
        $petId = $this->createPet($ownerId, $this->speciesId, $this->breedId);

        Sanctum::actingAs($this->createAdminUser());
        $this->postJson("/api/pets/{$petId}/health-form", $this->assessmentPayload())->assertOk();

        Sanctum::actingAs($this->createStaffUser('front_desk'));
        $this->postJson("/api/pets/{$petId}/health-form", $this->assessmentPayload([
            'medical_conditions' => 'Staff update',
        ]))->assertOk();

        $this->assertDatabaseHas('pet_assessment_form', [
            'pet_id' => $petId,
            'medical_conditions' => 'Staff update',
        ]);
    }
}
