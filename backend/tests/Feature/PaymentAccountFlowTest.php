<?php

namespace Tests\Feature;

use App\Models\ShopHoursSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class PaymentAccountFlowTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs($this->createAdminUser());
    }

    public function test_empty_payment_accounts_are_returned_without_sample_accounts(): void
    {
        $this->getJson('/api/clinic/payment-accounts')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_legacy_account_field_names_are_normalized_for_all_clients(): void
    {
        ShopHoursSetting::set('payment_accounts', [[
            'account_id' => 'legacy-gcash',
            'account_type' => 'e_wallet',
            'provider' => 'GCash',
            'accountName' => 'The Fur Club',
            'accountNumber' => '09171234567',
            'qr_url' => 'https://example.test/legacy-qr.png',
        ]]);

        $this->getJson('/api/clinic/payment-accounts')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'legacy-gcash')
            ->assertJsonPath('data.0.type', 'ewallet')
            ->assertJsonPath('data.0.label', 'GCash')
            ->assertJsonPath('data.0.account_name', 'The Fur Club')
            ->assertJsonPath('data.0.account_number', '09171234567')
            ->assertJsonPath('data.0.qr_code', 'https://example.test/legacy-qr.png');
    }

    public function test_qr_upload_is_persisted_and_preserved_when_not_replaced(): void
    {
        Storage::fake('public');
        config()->set('filesystems.disks.supabase.key', null);
        $png = 'data:image/png;base64,' . base64_encode('payment-qr-image');

        $save = $this->putJson('/api/admin/clinic/payment-accounts', [
            'accounts' => [[
                'id' => 'gcash-main',
                'type' => 'ewallet',
                'label' => 'GCash',
                'account_name' => 'The Fur Club',
                'account_number' => '09171234567',
                'qr_code' => $png,
            ]],
        ])->assertOk();

        $qrUrl = $save->json('data.0.qr_code');
        $this->assertIsString($qrUrl);
        $this->assertStringNotContainsString('data:image', $qrUrl);
        Storage::disk('public')->assertExists(str_replace(config('app.url') . '/storage/', '', $qrUrl));

        $this->putJson('/api/admin/clinic/payment-accounts', [
            'accounts' => [[
                'id' => 'gcash-main',
                'type' => 'ewallet',
                'label' => 'GCash',
                'account_name' => 'Updated Name',
                'account_number' => '09171234567',
            ]],
        ])->assertOk()->assertJsonPath('data.0.qr_code', $qrUrl);

        $this->getJson('/api/clinic/payment-accounts')
            ->assertOk()
            ->assertJsonPath('data.0.account_name', 'Updated Name')
            ->assertJsonPath('data.0.qr_code', $qrUrl);
    }

    public function test_known_mobile_provider_number_is_validated(): void
    {
        $this->putJson('/api/admin/clinic/payment-accounts', [
            'accounts' => [[
                'id' => 'gcash-main',
                'type' => 'ewallet',
                'label' => 'GCash',
                'account_name' => 'The Fur Club',
                'account_number' => '9171234567',
                'qr_code' => null,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('accounts');
    }

    public function test_bank_account_numbers_are_not_forced_to_one_length(): void
    {
        $this->putJson('/api/admin/clinic/payment-accounts', [
            'accounts' => [[
                'id' => 'bpi-main',
                'type' => 'bank',
                'label' => 'BPI',
                'account_name' => 'The Fur Club',
                'account_number' => '12345678901234',
                'qr_code' => null,
            ]],
        ])->assertOk()
            ->assertJsonPath('data.0.account_number', '12345678901234');
    }
}
