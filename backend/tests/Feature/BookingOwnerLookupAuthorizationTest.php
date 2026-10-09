<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class BookingOwnerLookupAuthorizationTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private function bookingOwnerLookupPaths(): array
    {
        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $this->createPet($ownerId, $speciesId, $breedId);

        return [
            '/api/booking/owners',
            "/api/booking/owners/{$ownerId}/pets",
        ];
    }

    public function test_customer_cannot_use_booking_owner_lookup_endpoints(): void
    {
        $paths = $this->bookingOwnerLookupPaths();
        Sanctum::actingAs($this->createCustomerUser());

        foreach ($paths as $path) {
            $this->getJson($path)->assertForbidden();
        }
    }

    public function test_staff_can_use_booking_owner_lookup_endpoints(): void
    {
        $paths = $this->bookingOwnerLookupPaths();
        Sanctum::actingAs($this->createStaffUser());

        foreach ($paths as $path) {
            $this->getJson($path)->assertOk();
        }
    }

    public function test_admin_can_use_booking_owner_lookup_endpoints(): void
    {
        $paths = $this->bookingOwnerLookupPaths();
        Sanctum::actingAs($this->createAdminUser());

        foreach ($paths as $path) {
            $this->getJson($path)->assertOk();
        }
    }
}
