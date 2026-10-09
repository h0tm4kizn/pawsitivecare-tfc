<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AppointmentPaymentController extends Controller
{
    private function depositProofDisk(): string
    {
        if (! config('filesystems.disks.supabase.key')) {
            return 'public';
        }

        try {
            Storage::disk('supabase');
            return 'supabase';
        } catch (\Throwable) {
            return 'public';
        }
    }

    private function depositProofUrl(string $disk, string $path, Request $request): string
    {
        if ($disk === 'public') {
            return rtrim($request->getSchemeAndHttpHost(), '/') . Storage::disk('public')->url($path);
        }

        $base = rtrim((string) config('filesystems.disks.supabase.public_url'), '/');
        if ($base === '') {
            $endpoint = (string) config('filesystems.disks.supabase.endpoint', '');
            $base = preg_replace('#/storage/v1/s3/?$#', '', rtrim($endpoint, '/'));
        }
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare-photo');

        return "{$base}/storage/v1/object/public/{$bucket}/{$path}";
    }

    public function uploadDepositProof(Request $request, Appointment $appointment)
    {
        $this->authorize('update', $appointment);

        $serviceType = strtolower((string) optional($appointment->service)->category);
        if (! str_contains($serviceType, 'hotel')) {
            return $this->error('Reservation deposit proof is only available for hotel bookings.', 422);
        }

        $request->validate([
            'proof' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);

        $disk = $this->depositProofDisk();
        $path = $request->file('proof')->store('appointments/deposit-proofs', $disk);
        $appointment->update([
            'reservation_deposit_proof_url' => $this->depositProofUrl($disk, $path, $request),
        ]);

        $savedAppointment = $appointment->fresh();
        $savedAppointment->setAttribute('reservation_deposit_proof_available', true);
        $savedAppointment->makeHidden('reservation_deposit_proof_url');

        return $this->success($savedAppointment, 'Reservation deposit proof saved.');
    }

    public function showDepositProof(Appointment $appointment)
    {
        $this->authorize('view', $appointment);

        $path = $this->depositProofStoragePath($appointment->reservation_deposit_proof_url);
        if (!$path) {
            return $this->error('Payment proof not found.', 404);
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            default => null,
        };
        if (!$contentType) {
            return $this->error('Payment proof not found.', 404);
        }

        $supabaseMarker = '/storage/v1/object/public/';
        $preferSupabase = str_contains((string) $appointment->reservation_deposit_proof_url, $supabaseMarker);
        $disks = $preferSupabase ? ['supabase', 'public'] : ['public', 'supabase'];
        $stream = false;
        foreach ($disks as $disk) {
            try {
                $storage = Storage::disk($disk);
                if ($storage->exists($path)) {
                    $stream = $storage->readStream($path);
                    if (is_resource($stream)) {
                        break;
                    }
                }
            } catch (\Throwable) {
                // Try the configured fallback disk without exposing storage details.
            }
        }

        if (!is_resource($stream)) {
            return $this->error('Payment proof not found.', 404);
        }

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'inline; filename="payment-proof.' . $extension . '"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function depositProofStoragePath(?string $storedValue): ?string
    {
        if (!$storedValue) {
            return null;
        }

        $path = parse_url($storedValue, PHP_URL_PATH);
        $path = rawurldecode(is_string($path) ? $path : $storedValue);
        $supabasePublicMarker = '/storage/v1/object/public/';
        if (($position = strpos($path, $supabasePublicMarker)) !== false) {
            // Supabase's public URL includes the bucket before the object path.
            // The Laravel disk already applies that bucket as its root.
            $bucketAndObject = substr($path, $position + strlen($supabasePublicMarker));
            $bucketSeparator = strpos($bucketAndObject, '/');
            if ($bucketSeparator === false) {
                return null;
            }
            $relativePath = substr($bucketAndObject, $bucketSeparator + 1);
        } else {
            $marker = 'appointments/deposit-proofs/';
            $position = strpos($path, $marker);
            if ($position === false) {
                return null;
            }
            $relativePath = substr($path, $position);
        }

        if (!str_starts_with($relativePath, 'appointments/deposit-proofs/')) {
            return null;
        }
        $segments = explode('/', $relativePath);
        if (in_array('..', $segments, true) || count($segments) < 3) {
            return null;
        }

        return $relativePath;
    }
}
