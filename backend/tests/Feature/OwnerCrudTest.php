<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #105 — Owner CRUD authorization tests.
 *
 * - Admin and staff can create owners
 * - Customer cannot create owners
 * - Admin can delete owners
 * - Staff cannot delete owners
 * - Customer can view and update their own profile
 */
class OwnerCrudTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private function ownerPayload(string $suffix = ''): array
    {
        return [
            'first_name'        => 'Jane',
            'last_name'         => 'Doe' . $suffix,
            'email'             => 'jane' . $suffix . rand(1, 9999) . '@test.com',
            'phone'             => '09' . rand(100000000, 999999999),
            'address'           => '123 Test Street, San Juan City',
            'preferred_contact' => 'email',
        ];
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_admin_can_create_owner(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/owners', $this->ownerPayload());

        $response->assertStatus(201)
                 ->assertJsonPath('status', 201);
    }

    public function test_staff_can_create_owner(): void
    {
        $staff = $this->createStaffUser('front_desk');
        Sanctum::actingAs($staff);

        $response = $this->postJson('/api/owners', $this->ownerPayload('_staff'));

        $response->assertStatus(201)
                 ->assertJsonPath('status', 201);
    }

    public function test_customer_cannot_create_owner(): void
    {
        $customer = $this->createCustomerUser();
        Sanctum::actingAs($customer);

        $response = $this->postJson('/api/owners', $this->ownerPayload('_customer'));

        $response->assertStatus(403);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public function test_admin_can_list_all_owners(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/owners');

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);
    }

    public function test_staff_can_list_all_owners(): void
    {
        $staff = $this->createStaffUser();
        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/owners');

        $response->assertStatus(200);
    }

    public function test_customer_cannot_list_all_owners(): void
    {
        $customer = $this->createCustomerUser();
        Sanctum::actingAs($customer);

        $response = $this->getJson('/api/owners');

        $response->assertStatus(403);
    }

    public function test_staff_can_use_customer_management_list_and_search_endpoint(): void
    {
        $staff = $this->createStaffUser();
        $this->createOwner();
        Sanctum::actingAs($staff);

        $this->getJson('/api/admin/owners?per_page=100')
            ->assertOk()
            ->assertJsonPath('status', 200);

        $this->getJson('/api/admin/owners?search=Test&per_page=100')
            ->assertOk()
            ->assertJsonPath('status', 200);
    }

    public function test_admin_can_use_customer_management_list_endpoint(): void
    {
        Sanctum::actingAs($this->createAdminUser());

        $this->getJson('/api/admin/owners?per_page=100')
            ->assertOk()
            ->assertJsonPath('status', 200);
    }

    public function test_customer_cannot_use_customer_management_list_endpoint(): void
    {
        Sanctum::actingAs($this->createCustomerUser());

        $this->getJson('/api/admin/owners?per_page=100')->assertForbidden();
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_admin_can_delete_owner(): void
    {
        $admin   = $this->createAdminUser();
        $ownerId = $this->createOwner();
        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/owners/{$ownerId}");

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);

        $this->assertSoftDeleted('owners', ['id' => $ownerId]);
    }

    public function test_staff_cannot_delete_owner(): void
    {
        $staff   = $this->createStaffUser();
        $ownerId = $this->createOwner();
        Sanctum::actingAs($staff);

        $response = $this->deleteJson("/api/owners/{$ownerId}");

        $response->assertStatus(403);

        $this->assertDatabaseHas('owners', ['id' => $ownerId]);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_admin_can_update_any_owner(): void
    {
        $admin   = $this->createAdminUser();
        $ownerId = $this->createOwner();
        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/owners/{$ownerId}", [
            'first_name'        => 'Updated',
            'last_name'         => 'Name',
            'email'             => 'updated.' . rand(1, 9999) . '@test.com',
            'phone'             => '09' . rand(100000000, 999999999),
            'preferred_contact' => 'phone',
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);
    }

    public function test_customer_can_update_their_own_profile(): void
    {
        $customer = $this->createCustomerUser();
        $ownerId  = $this->createOwner($customer->id);
        Sanctum::actingAs($customer);

        $response = $this->putJson('/api/my-profile', [
            'first_name'        => 'Customer',
            'last_name'         => 'Updated',
            'email'             => 'updated.' . rand(1, 9999) . '@test.com',
            'phone'             => '09' . rand(100000000, 999999999),
            'preferred_contact' => 'email',
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('status', 200);
    }
}
