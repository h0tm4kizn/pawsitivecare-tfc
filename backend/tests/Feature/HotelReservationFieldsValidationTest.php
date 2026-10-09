<?php

namespace Tests\Feature;

use App\Models\Appointment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class HotelReservationFieldsValidationTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_grooming_status_update_does_not_accept_hotel_deposit(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('grooming');
        $appointmentId = $this->createAppointment($petId, $serviceId, $admin->id, $ownerId);

        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Owner request',
            'deposit' => 100,
        ])->assertUnprocessable()
            ->assertJsonValidationErrorFor('deposit');

        $this->assertNull(Appointment::query()->findOrFail($appointmentId)->deposit);
    }

    public function test_hotel_status_update_still_accepts_reservation_deposit(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('hotel');
        $appointmentId = $this->createAppointment($petId, $serviceId, $admin->id, $ownerId);

        $this->patchJson("/api/appointments/{$appointmentId}/status", [
            'status' => 'cancelled',
            'cancellation_reason' => 'Owner request',
            'deposit' => 100,
        ])->assertOk();

        $this->assertSame(100.0, (float) Appointment::query()->findOrFail($appointmentId)->deposit);
    }
}
