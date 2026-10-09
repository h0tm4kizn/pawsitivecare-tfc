<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class PowerSyncTokenTest extends TestCase
{
    use RefreshDatabase;
    use TestDataHelper;

    private ?string $temporaryKeyPath = null;

    protected function tearDown(): void
    {
        if ($this->temporaryKeyPath && file_exists($this->temporaryKeyPath)) {
            unlink($this->temporaryKeyPath);
        }

        parent::tearDown();
    }

    public function test_guest_cannot_request_a_powersync_token(): void
    {
        $this->getJson('/api/powersync/token')->assertUnauthorized();
    }

    public function test_missing_signing_key_returns_a_sanitized_503(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        config()->set('services.powersync.url', 'https://sync.example.invalid');
        config()->set('services.powersync.ec_private_key', 'storage/app/powersync/missing-test-key.pem');

        $this->getJson('/api/powersync/token')
            ->assertStatus(503)
            ->assertJsonPath('message', 'Synchronization is temporarily unavailable.')
            ->assertJsonMissingPath('data.token');
    }

    public function test_authenticated_user_receives_an_es256_powersync_token(): void
    {
        $key = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_EC,
            'curve_name' => 'prime256v1',
        ]);
        $this->assertNotFalse($key);
        $this->temporaryKeyPath = tempnam(sys_get_temp_dir(), 'powersync-test-key-');
        $this->assertNotFalse($this->temporaryKeyPath);
        $this->assertTrue(openssl_pkey_export($key, $privatePem));
        $this->assertNotFalse(file_put_contents($this->temporaryKeyPath, $privatePem));

        $user = $this->createAdminUser();
        Sanctum::actingAs($user);
        config()->set('services.powersync.url', 'https://sync.example.invalid');
        config()->set('services.powersync.ec_private_key', $this->temporaryKeyPath);
        config()->set('services.powersync.ec_key_id', 'test-key-id');
        $ownerQueries = [];
        DB::listen(static function (QueryExecuted $query) use (&$ownerQueries): void {
            if (str_contains(strtolower($query->sql), 'owners')) {
                $ownerQueries[] = $query->sql;
            }
        });

        $response = $this->getJson('/api/powersync/token')
            ->assertOk()
            ->assertJsonPath('data.powersync_url', 'https://sync.example.invalid');

        $token = $response->json('data.token');
        $this->assertIsString($token);
        $parts = explode('.', $token);
        $this->assertCount(3, $parts);

        $decode = static function (string $part): array {
            $decoded = base64_decode(strtr($part, '-_', '+/'), true);
            return json_decode($decoded, true, 8, JSON_THROW_ON_ERROR);
        };
        $header = $decode($parts[0]);
        $claims = $decode($parts[1]);

        $this->assertSame('ES256', $header['alg'] ?? null);
        $this->assertSame('test-key-id', $header['kid'] ?? null);
        $this->assertSame($user->id, $claims['sub'] ?? null);
        $this->assertSame([], $ownerQueries, 'Admin token issuance should not query an owner profile.');
        $this->assertSame('https://sync.example.invalid', $claims['aud'] ?? null);
        $this->assertGreaterThanOrEqual(299, ($claims['exp'] ?? 0) - ($claims['iat'] ?? 0));
        $this->assertLessThanOrEqual(300, ($claims['exp'] ?? 0) - ($claims['iat'] ?? 0));

        $rawSignature = base64_decode(strtr($parts[2], '-_', '+/'), true);
        $this->assertSame(64, strlen($rawSignature));
        $publicKey = openssl_pkey_get_details($key)['key'];
        $this->assertSame(
            1,
            openssl_verify(
                $parts[0] . '.' . $parts[1],
                $this->rawSignatureToDer($rawSignature),
                $publicKey,
                OPENSSL_ALGO_SHA256,
            ),
        );
    }

    private function rawSignatureToDer(string $signature): string
    {
        $integers = [];
        foreach ([substr($signature, 0, 32), substr($signature, 32, 32)] as $integer) {
            $integer = ltrim($integer, "\x00");
            if ($integer === '' || (ord($integer[0]) & 0x80)) {
                $integer = "\x00" . $integer;
            }
            $integers[] = "\x02" . chr(strlen($integer)) . $integer;
        }

        $sequence = implode('', $integers);
        return "\x30" . chr(strlen($sequence)) . $sequence;
    }
}
