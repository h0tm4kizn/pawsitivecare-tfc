<?php

namespace Tests;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Shared test data factory helpers.
 * Used across all PawsitiveCare feature tests to avoid duplication.
 */
trait TestDataHelper
{
    protected function createAdminUser(): User
    {
        return User::create([
            'name'          => 'Admin User',
            'email'         => 'admin.' . Str::random(5) . '@test.com',
            'password_hash' => bcrypt('Password@123'),
            'role'          => 'admin',
            'staff_type'    => null,
            'is_active'     => true,
        ]);
    }

    protected function createStaffUser(string $type = 'front_desk', string $suffix = ''): User
    {
        return User::create([
            'name'          => 'Staff ' . $type . $suffix,
            'email'         => 'staff.' . $type . $suffix . Str::random(5) . '@test.com',
            'password_hash' => bcrypt('Password@123'),
            'role'          => 'staff',
            'staff_type'    => $type,
            'is_active'     => true,
        ]);
    }

    protected function createCustomerUser(): User
    {
        return User::create([
            'name'          => 'Customer User',
            'email'         => 'customer.' . Str::random(5) . '@test.com',
            'password_hash' => bcrypt('Password@123'),
            'role'          => 'customer',
            'staff_type'    => null,
            'is_active'     => true,
            'email_verified_at' => now('Asia/Manila'),
        ]);
    }

    protected function createOwner(?string $userId = null): string
    {
        $ownerId = (string) Str::uuid();
        DB::table('owners')->insert([
            'id'                => $ownerId,
            'user_id'           => $userId,
            'first_name'        => 'Test',
            'last_name'         => 'Owner',
            'email'             => 'owner.' . Str::random(5) . '@test.com',
            'phone'             => '09' . rand(100000000, 999999999),
            'address'           => '123 Test St, San Juan City',
            'preferred_contact' => 'email',
            'is_active'         => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
        return $ownerId;
    }

    protected function createSpeciesType(string $name = 'Dog', string $code = 'D'): string
    {
        $id = (string) Str::uuid();
        DB::table('species_types')->insert([
            'id'        => $id,
            'name'      => $name,
            'code'      => $code,
            'is_active' => true,
        ]);
        return $id;
    }

    protected function createBreed(string $speciesId, string $name = 'Aspin'): string
    {
        $id = (string) Str::uuid();
        DB::table('breeds')->insert([
            'id'         => $id,
            'species_id' => $speciesId,
            'name'       => $name,
            'is_active'  => true,
        ]);
        return $id;
    }

    protected function createPet(string $ownerId, string $speciesId, string $breedId): string
    {
        $id = (string) Str::uuid();
        DB::table('pets')->insert([
            'id'            => $id,
            'pet_id'      => 'TEST-' . strtoupper(Str::random(4)),
            'owner_id'      => $ownerId,
            'species_id'    => $speciesId,
            'breed_id'      => $breedId,
            'name'          => 'Buddy',
            'sex'           => 'male',
            'date_of_birth' => '2020-01-01',
            'weight_kg'     => 10.00,
            'created_at'    => now(),
        ]);
        return $id;
    }

    protected function createPetAssessment(string $petId, string $ownerId): void
    {
        DB::table('pet_assessment_form')->insert([
            'id'                   => (string) Str::uuid(),
            'pet_id'               => $petId,
            'owner_id'             => $ownerId,
            'is_vaccinated'        => 'yes',
            'vaccine_rabies'       => true,
            'declaration_accepted' => true,
            'certified_at'         => now(),
            'created_at'           => now(),
            'updated_at'           => now(),
        ]);
    }

    protected function createService(string $category = 'grooming'): string
    {
        $id = (string) Str::uuid();
        DB::table('services')->insert([
            'id'          => $id,
            'name'        => 'Test Service ' . Str::random(4),
            'category'    => $category,
            'description' => 'Test',
            'is_active'   => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
        return $id;
    }

    protected function createAppointment(
        string $petId,
        string $serviceId,
        ?string $handledBy = null,
        ?string $bookedByOwnerId = null
    ): string {
        $id = (string) Str::uuid();
        DB::table('appointments')->insert([
            'id'                  => $id,
            'pet_id'              => $petId,
            'service_id'          => $serviceId,
            'hotel_suite_id'      => null,
            'handled_by'          => $handledBy,
            'booked_by_owner_id'  => $bookedByOwnerId,
            'size_label'          => 'medium',
            'status'              => 'pending',
            'appointment_date'    => now()->addDay()->toDateString(),
            'start_time'          => '09:00:00',
            'total_price'         => 500.00,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);
        return $id;
    }
}
