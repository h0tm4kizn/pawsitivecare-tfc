<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

/**
 * Task #110d — Staff type filter on GET /admin/staff.
 *
 * - ?type=front_desk returns only front_desk staff
 * - ?type=groomer returns only groomer staff
 * - No filter returns all staff
 */
class StaffTypeFilterTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_filter_by_front_desk_returns_only_front_desk_staff(): void
    {
        $admin = $this->createAdminUser();
        $this->createStaffUser('front_desk', '_1');
        $this->createStaffUser('front_desk', '_2');
        $this->createStaffUser('groomer', '_3');

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/admin/staff?type=front_desk');

        $response->assertStatus(200);

        $staff = $response->json('data.data');
        $this->assertCount(2, $staff);
        foreach ($staff as $member) {
            $this->assertEquals('front_desk', $member['staff_type']);
        }
    }

    public function test_filter_by_groomer_returns_only_groomer_staff(): void
    {
        $admin = $this->createAdminUser();
        $this->createStaffUser('front_desk', '_1');
        $this->createStaffUser('groomer', '_2');
        $this->createStaffUser('groomer', '_3');

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/admin/staff?type=groomer');

        $response->assertStatus(200);

        $staff = $response->json('data.data');
        $this->assertCount(2, $staff);
        foreach ($staff as $member) {
            $this->assertEquals('groomer', $member['staff_type']);
        }
    }

    public function test_no_filter_returns_all_staff(): void
    {
        $admin = $this->createAdminUser();
        $this->createStaffUser('front_desk', '_1');
        $this->createStaffUser('front_desk', '_2');
        $this->createStaffUser('groomer', '_3');

        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(200);

        $staff = $response->json('data.data');
        $this->assertCount(3, $staff);
    }

    public function test_staff_can_read_staff_management_directory(): void
    {
        $staff = $this->createStaffUser('front_desk');
        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/admin/staff');

        $response->assertStatus(200);
    }
}
