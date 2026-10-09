<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #108 — Middleware blocks 401 (no token) and 403 (wrong role).
 */
class MiddlewareAccessTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    // ── 401 Tests ─────────────────────────────────────────────────────────────

    public function test_unauthenticated_request_to_protected_route_returns_401(): void
    {
        $response = $this->getJson('/api/owners');

        $response->assertStatus(401)
                 ->assertJsonPath('status', 401);
    }

    public function test_unauthenticated_request_to_admin_only_route_returns_401(): void
    {
        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(401)
                 ->assertJsonPath('status', 401);
    }

    // ── 403 Tests ─────────────────────────────────────────────────────────────

    public function test_staff_token_on_admin_only_route_returns_403(): void
    {
        $staff = $this->createStaffUser('front_desk');
        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(403);
    }

    public function test_customer_token_on_admin_only_route_returns_403(): void
    {
        $customer = $this->createCustomerUser();
        Sanctum::actingAs($customer);

        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(403);
    }

    public function test_customer_token_on_admin_staff_shared_route_returns_403(): void
    {
        $customer = $this->createCustomerUser();
        Sanctum::actingAs($customer);

        // /api/owners is admin+staff only
        $response = $this->getJson('/api/owners');

        $response->assertStatus(403)
                 ->assertJsonPath('status', 403);
    }

    // ── 200 Pass-through ──────────────────────────────────────────────────────

    public function test_admin_token_on_admin_only_route_passes(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(200);
    }

    public function test_staff_token_on_shared_route_passes(): void
    {
        $staff = $this->createStaffUser('front_desk');
        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/owners');

        $response->assertStatus(200);
    }
}
