<?php

namespace Tests\Feature;

use App\Models\ShopHoursSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class AppointmentPaymentInformationTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    public function test_admin_appointment_list_exposes_saved_payment_fields_and_safe_proof_metadata(): void
    {
        config()->set('filesystems.disks.supabase.key', null);
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        ShopHoursSetting::set('payment_accounts', [[
            'id' => 'gcash-main',
            'type' => 'ewallet',
            'label' => 'GCash',
            'account_name' => 'The Fur Club',
            'account_number' => '09171234567',
            'qr_code' => 'https://example.test/private-qr.png',
        ]]);

        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $serviceId = $this->createService('hotel');
        $appointmentId = $this->createAppointment($petId, $serviceId, $admin->id, $ownerId);
        DB::table('appointments')->where('id', $appointmentId)->update([
            'reference_number' => 'REF-12345',
            'reservation_channel' => 'e_wallet',
            'reservation_payer_provider' => 'GCash',
            'reservation_payment_account_id' => 'gcash-main',
            'reservation_deposit_proof_url' => 'https://storage.example.test/storage/appointments/deposit-proofs/proof.png',
            'reservation_payment_account_snapshot' => json_encode([
                'id' => 'gcash-main',
                'type' => 'ewallet',
                'label' => 'GCash at booking time',
                'account_name' => 'The Fur Club (old)',
                'account_number' => '09170000000',
            ]),
        ]);
        ShopHoursSetting::set('payment_accounts', [[
            'id' => 'gcash-main',
            'type' => 'ewallet',
            'label' => 'GCash Current',
            'account_name' => 'The Fur Club (updated)',
            'account_number' => '09990000000',
        ]]);

        $response = $this->getJson('/api/appointments?status=pending');
        $response->assertOk()
            ->assertJsonPath('data.data.0.reference_number', 'REF-12345')
            ->assertJsonPath('data.data.0.reservation_channel', 'e_wallet')
            ->assertJsonPath('data.data.0.reservation_payer_provider', 'GCash')
            ->assertJsonPath('data.data.0.reservation_payment_account.id', 'gcash-main')
            ->assertJsonPath('data.data.0.reservation_payment_account.label', 'GCash at booking time')
            ->assertJsonPath('data.data.0.reservation_payment_account.account_name', 'The Fur Club (old)')
            ->assertJsonPath('data.data.0.reservation_payment_account.account_number', '09170000000')
            ->assertJsonPath('data.data.0.reservation_deposit_proof_available', true)
            ->assertJsonMissingPath('data.data.0.reservation_deposit_proof_url')
            ->assertJsonMissingPath('data.data.0.reservation_payment_account.qr_code')
            ->assertJsonMissingPath('data.data.0.reservation_payment_account_snapshot');
    }

    public function test_admin_can_view_payment_proof_through_authenticated_stream_endpoint(): void
    {
        Storage::fake('public');
        config()->set('filesystems.disks.supabase.key', null);
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);

        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $appointmentId = $this->createAppointment($petId, $this->createService('hotel'), $admin->id, $ownerId);
        $proofPath = 'appointments/deposit-proofs/proof.png';
        Storage::disk('public')->put($proofPath, 'test-proof-bytes');
        DB::table('appointments')->where('id', $appointmentId)->update([
            'reservation_deposit_proof_url' => 'http://localhost/storage/' . $proofPath,
        ]);

        $response = $this->get('/api/appointments/' . $appointmentId . '/deposit-proof');
        $response->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame('test-proof-bytes', $response->streamedContent());
    }

    public function test_admin_list_does_not_substitute_current_recipient_details_when_no_booking_snapshot_exists(): void
    {
        $admin = $this->createAdminUser();
        Sanctum::actingAs($admin);
        ShopHoursSetting::set('payment_accounts', [[
            'id' => 'gcash-old',
            'type' => 'ewallet',
            'label' => 'Current GCash',
            'account_name' => 'Current Recipient',
            'account_number' => '09990000000',
        ]]);

        $ownerId = $this->createOwner();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $appointmentId = $this->createAppointment($petId, $this->createService('hotel'), $admin->id, $ownerId);
        DB::table('appointments')->where('id', $appointmentId)->update([
            'reservation_payment_account_id' => 'gcash-old',
            'reservation_provider' => 'Ambiguous legacy value',
        ]);

        $this->getJson('/api/appointments?status=pending')
            ->assertOk()
            ->assertJsonPath('data.data.0.reservation_payment_account_id', 'gcash-old')
            ->assertJsonPath('data.data.0.reservation_payment_account', null);
    }

    public function test_payment_proof_endpoint_requires_authentication_and_appointment_access(): void
    {
        Storage::fake('public');
        config()->set('filesystems.disks.supabase.key', null);

        $ownerUser = $this->createCustomerUser();
        $ownerId = $this->createOwner($ownerUser->id);
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        $appointmentId = $this->createAppointment($petId, $this->createService('hotel'), null, $ownerId);
        $proofPath = 'appointments/deposit-proofs/private.png';
        Storage::disk('public')->put($proofPath, 'private-proof');
        DB::table('appointments')->where('id', $appointmentId)->update([
            'reservation_deposit_proof_url' => 'http://localhost/storage/' . $proofPath,
        ]);
        $endpoint = '/api/appointments/' . $appointmentId . '/deposit-proof';

        auth()->logout();
        $this->get($endpoint)->assertUnauthorized();

        Sanctum::actingAs($this->createCustomerUser());
        $this->get($endpoint)->assertForbidden();

        Sanctum::actingAs($ownerUser);
        $this->get($endpoint)->assertOk();
    }
}
