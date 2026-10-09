<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use JsonException;
use LogicException;

class StaffQrCredentialService
{
    public function issue(User $staff, bool $reissue = false): string
    {
        return DB::transaction(function () use ($staff, $reissue): string {
            $lockedStaff = User::query()->whereKey($staff->id)->lockForUpdate()->firstOrFail();
            if (!$lockedStaff->isStaff() || trim((string) $lockedStaff->display_id) === '') {
                throw new LogicException('A staff account with an assigned Staff ID is required.');
            }

            $token = null;
            if (!$reissue && $lockedStaff->qr_credential) {
                try {
                    $token = Crypt::decryptString($lockedStaff->qr_credential);
                } catch (DecryptException $exception) {
                    throw new LogicException('The stored QR credential cannot be decrypted; explicitly reissue it.', previous: $exception);
                }
            }

            if ($token === null) {
                $token = bin2hex(random_bytes(32));
                $lockedStaff->qr_credential = Crypt::encryptString($token);
                $lockedStaff->save();
            }

            try {
                return json_encode([
                    'v' => 1,
                    'staff_id' => (string) $lockedStaff->display_id,
                    'credential' => $token,
                ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            } catch (JsonException $exception) {
                throw new LogicException('Unable to encode the staff QR credential.', previous: $exception);
            }
        });
    }

    public function resolve(string $payload): ?User
    {
        try {
            $data = json_decode($payload, true, 8, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        if (
            !is_array($data)
            || ($data['v'] ?? null) !== 1
            || !is_string($data['staff_id'] ?? null)
            || !is_string($data['credential'] ?? null)
            || !preg_match('/^[a-f0-9]{64}$/', $data['credential'])
        ) {
            return null;
        }

        $staff = User::query()
            ->where('display_id', $data['staff_id'])
            ->where('role', 'staff')
            ->first();

        if (!$staff || !$staff->is_active || !$staff->qr_credential) {
            return null;
        }

        try {
            $storedCredential = Crypt::decryptString($staff->qr_credential);
        } catch (DecryptException) {
            return null;
        }

        return hash_equals($storedCredential, $data['credential']) ? $staff : null;
    }

    public function matches(User $staff, string $payload): bool
    {
        $resolved = $this->resolve($payload);
        return $resolved !== null && $resolved->is($staff);
    }
}
