<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopHoursSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentAccountController extends Controller
{
    private function qrStorageDisk(): string
    {
        if (! config('filesystems.disks.supabase.key')
            || ! config('filesystems.disks.supabase.secret')
            || ! config('filesystems.disks.supabase.public_url')) {
            return 'public';
        }

        try {
            Storage::disk('supabase');
            return 'supabase';
        } catch (\Throwable) {
            return 'public';
        }
    }

    private function qrStorageUrl(string $disk, string $path, Request $request): string
    {
        if ($disk === 'public') {
            return rtrim($request->getSchemeAndHttpHost(), '/') . Storage::disk('public')->url($path);
        }

        $base = rtrim((string) config('filesystems.disks.supabase.public_url'), '/');
        if ($base === '') {
            $endpoint = (string) config('filesystems.disks.supabase.endpoint', '');
            $base = preg_replace('#/storage/v1/s3/?$#', '', rtrim($endpoint, '/'));
        }
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare');

        return "{$base}/storage/v1/object/public/{$bucket}/{$path}";
    }

    public function index()
    {
        $accounts = collect(ShopHoursSetting::get('payment_accounts', []))
            ->filter(fn ($account) => is_array($account))
            ->map(fn (array $account) => $this->normalizeAccount($account))
            ->filter(fn (array $account) => $account['id'] !== '' && $account['label'] !== '')
            ->values()
            ->all();

        return response()->json(['data' => $accounts]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'accounts' => 'present|array|max:20',
            'accounts.*.id' => 'required|string|max:80',
            'accounts.*.type' => 'required|in:ewallet,bank',
            'accounts.*.label' => 'required|string|max:80',
            'accounts.*.account_name' => 'nullable|string|max:120',
            'accounts.*.account_number' => 'nullable|string|max:80',
            'accounts.*.qr_code' => 'nullable|string',
        ]);

        $disk = $this->qrStorageDisk();
        $existingAccounts = collect(ShopHoursSetting::get('payment_accounts', []))
            ->filter(fn ($account) => is_array($account))
            ->mapWithKeys(fn (array $account) => [(string) ($account['id'] ?? '') => $this->normalizeAccount($account)]);

        $accounts = collect($validated['accounts'])->map(function (array $account) use ($disk, $request, $existingAccounts) {
            $this->validateAccountNumber($account);

            $existingQr = data_get($existingAccounts->get((string) $account['id']), 'qr_code');
            $qr = array_key_exists('qr_code', $account) && $account['qr_code'] !== null
                ? $account['qr_code']
                : $existingQr;
            if (is_string($qr) && preg_match('/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s', $qr, $matches)) {
                $binary = base64_decode($matches[2], true);
                abort_if($binary === false || strlen($binary) > 2 * 1024 * 1024, 422, 'QR image must be 2 MB or smaller.');
                $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
                $path = 'payment-qr/' . Str::uuid() . '.' . $extension;
                $stored = Storage::disk($disk)->put($path, $binary, 'public');
                abort_if(!$stored, 422, 'Unable to store the QR image.');
                $qr = $this->qrStorageUrl($disk, $path, $request);
            }

            return [
                'id' => $account['id'],
                'type' => $account['type'],
                'label' => trim($account['label']),
                'account_name' => trim($account['account_name'] ?? ''),
                'account_number' => trim($account['account_number'] ?? ''),
                'qr_code' => $qr,
            ];
        })->values()->all();

        ShopHoursSetting::set('payment_accounts', $accounts);

        return response()->json(['message' => 'Payment accounts updated.', 'data' => $accounts]);
    }

    private function normalizeAccount(array $account): array
    {
        $type = strtolower(trim((string) ($account['type'] ?? $account['account_type'] ?? '')));
        $type = match ($type) {
            'e_wallet', 'e-wallet' => 'ewallet',
            'bank_transfer', 'bank-transfer' => 'bank',
            default => $type,
        };

        return [
            'id' => (string) ($account['id'] ?? $account['account_id'] ?? ''),
            'type' => $type,
            'label' => trim((string) ($account['label'] ?? $account['provider'] ?? $account['provider_name'] ?? '')),
            'account_name' => trim((string) ($account['account_name'] ?? $account['accountName'] ?? '')),
            'account_number' => trim((string) ($account['account_number'] ?? $account['accountNumber'] ?? '')),
            'qr_code' => $account['qr_code'] ?? $account['qrCode'] ?? $account['qr_url'] ?? null,
        ];
    }

    private function validateAccountNumber(array $account): void
    {
        $provider = strtolower(trim((string) $account['label']));
        $number = trim((string) ($account['account_number'] ?? ''));

        if ($number === '') {
            return;
        }

        if (in_array($provider, ['gcash', 'maya', 'grabpay'], true) && !preg_match('/^09\d{9}$/', $number)) {
            throw ValidationException::withMessages([
                'accounts' => [ucfirst($provider) . ' account number must contain exactly 11 digits and start with 09.'],
            ]);
        }
    }
}
