<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Support\CustomerAppointmentFormatter;

/**
 * PowerSync Backend Connector Controller
 *
 * Handles three concerns:
 * 1. /token  — issues a short-lived JWT for the PowerSync sync stream
 * 2. /sync   — legacy endpoint (client downloads table changes since last cursor)
 * 3. /upload — applies offline mutations to Supabase when connection restores
 *
 * Security:
 * - All routes require Sanctum bearer token
 * - Upload mutations are filtered by ownership before being applied
 * - RLS policies on Supabase provide an additional server-side safety net
 */
class PowerSyncController extends Controller
{
    // ── Token Endpoint ────────────────────────────────────────────────────

    /**
     * Issue a short-lived JWT for the PowerSync Cloud sync stream.
     *
     * Called by the frontend connector's fetchCredentials() every few minutes.
     * The token lifetime is 5 minutes — PowerSync refreshes automatically.
     *
     * The JWT sub claim is the authenticated user's UUID. The sync-config.yaml
     * owner-scoped queries join owners ON owners.user_id = auth.user_id() so
     * each client only syncs data belonging to their account.
     */
    public function token(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $keyPath  = config('services.powersync.ec_private_key');
        $endpoint = config('services.powersync.url');

        if (!$keyPath || !$endpoint) {
            Log::error('PowerSync token configuration is incomplete.', [
                'has_key_path' => (bool) $keyPath,
                'has_endpoint' => (bool) $endpoint,
            ]);
            return $this->error('Synchronization is temporarily unavailable.', 503);
        }

        $isAbsolutePath = str_starts_with($keyPath, DIRECTORY_SEPARATOR)
            || (bool) preg_match('/^[A-Za-z]:[\\\\\/]/', $keyPath);
        $resolvedPath = $isAbsolutePath ? $keyPath : base_path($keyPath);
        if (!file_exists($resolvedPath)) {
            Log::error('PowerSync signing key file is unavailable.', ['path_configured' => true]);
            return $this->error('Synchronization is temporarily unavailable.', 503);
        }

        // Use the owner's UUID as sub so sync rules (WHERE owner_id = auth.user_id())
        // work without requiring the owners table to be in the publication.
        // Falls back to user.id for staff/admin who have no owner profile.
        $subject = $user->isCustomer()
            ? ($user->owner?->id ?? $user->id)
            : $user->id;

        $token = $this->generateJwt($subject, $endpoint, $resolvedPath);

        return $this->success([
            'token'         => $token,
            'powersync_url' => $endpoint,
        ], 'PowerSync token issued');
    }

    /**
     * Generate an ES256-signed JWT for PowerSync using the EC P-256 private key.
     *
     * Claims:
     *  sub — user UUID (returned by auth.user_id() in sync rules)
     *  aud — PowerSync instance URL
     *  iat — issued-at (now)
     *  exp — expiry (now + 5 min; max allowed is 24 h)
     */
    private function generateJwt(string $userId, string $audience, string $keyPath): string
    {
        $keyId   = config('services.powersync.ec_key_id');
        $header  = $this->base64UrlEncode(json_encode(['alg' => 'ES256', 'typ' => 'JWT', 'kid' => $keyId]));
        $payload = $this->base64UrlEncode(json_encode([
            'sub' => $userId,
            'aud' => $audience,
            'iat' => time(),
            'exp' => time() + 300, // 5 minutes
        ]));

        $pem        = file_get_contents($keyPath);
        $privateKey = openssl_pkey_get_private($pem);

        openssl_sign("{$header}.{$payload}", $derSignature, $privateKey, OPENSSL_ALGO_SHA256);

        // Convert DER-encoded signature to raw (r || s) format required by JWS
        $signature = $this->base64UrlEncode($this->derToRaw($derSignature));

        return "{$header}.{$payload}.{$signature}";
    }

    /**
     * Convert a DER-encoded ECDSA signature to the raw (r || s) format
     * required by JSON Web Signatures (RFC 7518 §3.4).
     *
     * OpenSSL produces DER; JWT expects 64 raw bytes (32 each for r and s).
     */
    private function derToRaw(string $der): string
    {
        // DER structure: 0x30 [len] 0x02 [r_len] [r] 0x02 [s_len] [s]
        $offset = 2; // skip sequence tag + length
        $offset++; // skip integer tag for r
        $rLen = ord($der[$offset++]);
        $r    = substr($der, $offset, $rLen);
        $offset += $rLen;
        $offset++; // skip integer tag for s
        $sLen = ord($der[$offset++]);
        $s    = substr($der, $offset, $sLen);

        // Remove leading zero padding, then pad to 32 bytes
        $r = ltrim($r, "\x00");
        $s = ltrim($s, "\x00");
        $r = str_pad($r, 32, "\x00", STR_PAD_LEFT);
        $s = str_pad($s, 32, "\x00", STR_PAD_LEFT);

        return $r . $s;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }


    /**
     * Handle sync requests — client downloading data from server
     * 
     * Client sends: last sync cursor (timestamp or ID)
     * Server responds: all changes since last cursor
     * 
     * This enables incremental sync — only new/changed data is sent
     */
    public function sync(Request $request): JsonResponse
    {
        // Validate Sanctum authentication
        if (!$request->user()) {
            return $this->error('Unauthorized', 401);
        }

        $user = $request->user();
        $cursor = $request->input('cursor'); // Last sync timestamp

        try {
            // Build sync response with table changes
            // Filter by user ID to respect data ownership
            
            $syncData = [
                'pets' => $this->syncPets($user, $cursor),
                'appointments' => $this->syncAppointments($user, $cursor),
                'appointment_addons' => $this->syncAppointmentAddons($user, $cursor),
                'services' => $this->syncServices($cursor),
                'hotel_suites' => $this->syncHotelSuites($cursor),
                'breeds' => $this->syncBreeds($cursor),
                'notifications' => $this->syncNotifications($user, $cursor),
            ];

            // Return new cursor for next sync
            $newCursor = now()->timestamp;

            return $this->success([
                'cursor' => $newCursor,
                'data' => $syncData,
            ], 'Sync completed');
        } catch (\Exception $e) {
            Log::error('PowerSync sync failed.', [
                'user_id' => $request->user()?->id,
                'cursor' => $cursor,
                'exception' => $e,
            ]);
            return $this->error('Unable to synchronize data at this time.', 500);
        }
    }

    /**
     * Handle upload requests — client sending mutations to server
     * 
     * Client sends: array of mutations (inserts, updates, deletes)
     * Server applies: mutations to Supabase and returns confirmation
     * 
     * PowerSync queues mutations if offline; this endpoint applies them
     * when connection is restored.
     */
    public function upload(Request $request): JsonResponse
    {
        // Validate Sanctum authentication
        if (!$request->user()) {
            return $this->error('Unauthorized', 401);
        }

        $user = $request->user();
        $mutations = $request->input('mutations', []);

        try {
            $results = [];

            foreach ($mutations as $mutation) {
                $table = $mutation['table'] ?? null;
                $op = $mutation['op'] ?? null; // 'INSERT', 'UPDATE', 'DELETE'
                $data = $mutation['data'] ?? [];

                // Authorization: only process mutations user owns
                if (!$this->canMutate($user, $table, $op, $data)) {
                    continue; // Skip unauthorized mutations
                }

                // Apply mutation to Supabase via Laravel ORM
                $result = $this->applyMutation($table, $op, $data);
                $results[] = [
                    'table' => $table,
                    'op' => $op,
                    'id' => $data['id'] ?? null,
                    'success' => $result,
                ];
            }

            return $this->success([
                'mutations' => $results,
            ], 'Mutations uploaded');
        } catch (\Exception $e) {
            Log::error('PowerSync upload failed.', [
                'user_id' => $request->user()?->id,
                'exception' => $e,
            ]);
            return $this->error('Unable to upload changes at this time.', 500);
        }
    }

    // ── Sync Methods ─────────────────────────────────────────────────────

    private function syncPets($user, $cursor)
    {
        // Owner can only sync their own pets
        $ownerID = $user->owner?->id;

        return DB::table('pets')
            ->where('owner_id', $ownerID)
            ->when($cursor, function ($q) use ($cursor) {
                $q->where('updated_at', '>', $cursor);
            })
            ->get();
    }

    private function syncAppointments($user, $cursor)
    {
        // Owner sees appointments for their pets
        // Staff sees appointments they're handling
        $ownerID = $user->owner?->id;

        $query = DB::table('appointments');

        if ($user->owner) {
            // Owner: only their booked appointments
            $query->where('booked_by_owner_id', $ownerID);
            $query->leftJoin('users as handled_staff', 'handled_staff.id', '=', 'appointments.handled_by');
            $query->select([
                'appointments.id', 'appointments.pet_id', 'appointments.service_id', 'appointments.hotel_suite_id',
                'appointments.booked_by_owner_id', 'appointments.size_label', 'appointments.status',
                'appointments.appointment_date', 'appointments.start_time', 'appointments.check_in_time', 'appointments.check_out_time', 'appointments.completed_at',
                'appointments.daycare_duration', 'appointments.hotel_nights', 'appointments.special_instructions', 'appointments.total_price', 'appointments.deposit',
                'appointments.reference_number', 'appointments.reservation_channel', 'appointments.reservation_provider', 'appointments.reservation_payment_account_id',
                'appointments.reservation_payer_provider', 'appointments.reservation_deposit_proof_url', 'appointments.notes', 'appointments.appointment_code',
                'appointments.cancellation_reason', 'appointments.cancelled_at', 'appointments.cancellation_type', 'appointments.is_full_day_package',
                'appointments.grooming_discount', 'appointments.created_at', 'appointments.updated_at',
                'handled_staff.name as handled_by_name',
            ]);
        } else {
            // Staff: appointments they're assigned to
            $query->where('handled_by', $user->id);
        }

        $rows = $query->when($cursor, function ($q) use ($cursor) {
            $q->where('appointments.updated_at', '>', $cursor);
        })->get();

        if ($user->owner) {
            $rows->transform(function ($row) {
                $row->cancellation_reason = CustomerAppointmentFormatter::reason($row->cancellation_reason);
                return $row;
            });
        }

        return $rows;
    }

    private function syncAppointmentAddons($user, $cursor)
    {
        // Only sync add-ons for appointments user can see
        $ownerID = $user->owner?->id;

        $subquery = DB::table('appointments');
        if ($user->owner) {
            $subquery->where('booked_by_owner_id', $ownerID);
        } else {
            $subquery->where('handled_by', $user->id);
        }

        return DB::table('appointment_addons')
            ->whereIn('appointment_id', $subquery->pluck('id'))
            ->when($cursor, function ($q) use ($cursor) {
                $q->where('updated_at', '>', $cursor);
            })
            ->get();
    }

    private function syncServices($cursor)
    {
        // Services are public — everyone syncs the same data
        return DB::table('services')
            ->whereRaw('"is_active" = true')
            ->when($cursor, function ($q) use ($cursor) {
                $q->where('updated_at', '>', $cursor);
            })
            ->get();
    }

    private function syncHotelSuites($cursor)
    {
        // Hotel suites are reference data — public to all
        return DB::table('hotel_suites')
            ->whereRaw('"is_available" = true')
            ->when($cursor, function ($q) use ($cursor) {
                $q->where('updated_at', '>', $cursor);
            })
            ->get();
    }

    private function syncBreeds($cursor)
    {
        // Breed data is reference — public to all
        return DB::table('breeds')
            ->where('is_active', true)
            ->when($cursor, function ($q) use ($cursor) {
                // Note: breeds table may not have updated_at — adjust as needed
                // $q->where('updated_at', '>', $cursor);
            })
            ->get();
    }

    private function syncNotifications($user, $cursor)
    {
        // Owner sees notifications sent to them
        $ownerID = $user->owner?->id;

        return DB::table('notifications')
            ->where('owner_id', $ownerID)
            ->when($cursor, function ($q) use ($cursor) {
                $q->where('created_at', '>', $cursor);
            })
            ->get();
    }

    // ── Authorization & Mutation Methods ──────────────────────────────────

    /**
     * Check if user is authorized to mutate this data
     * 
     * Rules:
     * - Owners can only mutate their own data (pets, appointments)
     * - Staff cannot mutate appointments (read-only for now)
     * - System fields (created_at, id) cannot be mutated
     */
    private function canMutate($user, $table, $op, $data): bool
    {
        $ownerID = $user->owner?->id;
        $id = $data['id'] ?? null;
        $isStaffOrAdmin = $user->isAdmin() || $user->isStaff();

        switch ($table) {
            case 'pets':
                // Owners can only mutate their own pets
                if (!$user->owner) {
                    return false;
                }
                if ($op === 'INSERT') {
                    return ($data['owner_id'] ?? null) === $ownerID;
                }
                if (in_array($op, ['UPDATE', 'DELETE'], true)) {
                    return $id && $this->rowOwnedBy('pets', $id, 'owner_id', $ownerID);
                }
                return false;

            case 'appointments':
                // Staff/Admin may update appointment workflow fields offline.
                if ($isStaffOrAdmin && $op === 'UPDATE' && $id) {
                    if ($user->isAdmin() || $user->isFrontDeskStaff()) {
                        return DB::table('appointments')->where('id', $id)->exists();
                    }

                    $appointment = DB::table('appointments')
                        ->join('services', 'services.id', '=', 'appointments.service_id')
                        ->where('appointments.id', $id)
                        ->where('appointments.handled_by', $user->id)
                        ->where('services.category', 'grooming')
                        ->first(['appointments.status']);

                    if (!$appointment) {
                        return false;
                    }

                    $allowed = ['notes', 'special_instructions', 'status'];
                    if (array_diff(array_keys($data), array_merge(['id'], $allowed))) {
                        return false;
                    }

                    return !isset($data['status']) || in_array($data['status'], ['in_progress', 'completed'], true);
                }
                if (!$user->owner) {
                    return false;
                }
                if ($op === 'INSERT') {
                    return ($data['booked_by_owner_id'] ?? null) === $ownerID;
                }
                if ($op === 'UPDATE') {
                    return $id && $this->rowOwnedBy('appointments', $id, 'booked_by_owner_id', $ownerID);
                }
                // Keep hard delete disabled for appointments.
                return false;

            case 'notifications':
                // Allow owners to mark only their own notifications as read/unread.
                return $user->owner
                    && $op === 'UPDATE'
                    && $id
                    && $this->rowOwnedBy('notifications', $id, 'owner_id', $ownerID);

            default:
                // Reference data (services, breeds, suites) is read-only
                return false;
        }
    }

    /**
     * Apply a single mutation to Supabase
     * 
     * Called after authorization check passes
     */
    private function applyMutation($table, $op, $data): bool
    {
        try {
            $payload = $this->filterMutationPayload($table, $op, $data);

            switch ($op) {
                case 'INSERT':
                    if (empty($payload)) return false;
                    DB::table($table)->insert($payload);
                    return true;

                case 'UPDATE':
                    if (!isset($data['id']) || empty($payload)) return false;
                    DB::table($table)
                        ->where('id', $data['id'])
                        ->update($payload);
                    return true;

                case 'DELETE':
                    // Delete remains available only where canMutate() permits it.
                    if (!isset($data['id'])) return false;
                    DB::table($table)
                        ->where('id', $data['id'])
                        ->delete();
                    return true;

                default:
                    return false;
            }
        } catch (\Exception $e) {
            \Log::error('PowerSync mutation failed', [
                'table' => $table,
                'op' => $op,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    private function rowOwnedBy(string $table, string $id, string $ownerColumn, string $ownerId): bool
    {
        if (!$ownerId) {
            return false;
        }

        return DB::table($table)
            ->where('id', $id)
            ->where($ownerColumn, $ownerId)
            ->exists();
    }

    private function filterMutationPayload(string $table, string $op, array $data): array
    {
        $writable = match ($table) {
            'pets' => [
                'owner_id', 'species_id', 'breed_id', 'pet_id', 'name', 'sex',
                'date_of_birth', 'weight_kg', 'medical_notes', 'photo_url',
                'identification_hash', 'identification_image_url',
                'recognition_registered', 'recognition_registered_at', 'is_active',
            ],
            'appointments' => $op === 'INSERT'
                ? [
                    'pet_id', 'service_id', 'hotel_suite_id', 'booked_by_owner_id',
                    'size_label', 'appointment_date', 'start_time', 'daycare_duration',
                    'hotel_nights', 'special_instructions', 'total_price', 'deposit',
                    'reference_number', 'notes', 'is_full_day_package', 'grooming_discount',
                ]
                : [
                    // Keep updates limited to customer-editable fields.
                    'special_instructions', 'deposit', 'reference_number', 'notes', 'hotel_nights', 'daycare_duration',
                    // Allow offline reschedule/cancel to sync back.
                    'appointment_date', 'start_time', 'status', 'cancellation_reason',
                    'reschedule_requested_at',
                    'cancelled_at', 'cancelled_by', 'cancellation_type',
                ],
            'notifications' => ['is_read', 'read_at'],
            default => [],
        };

        return array_intersect_key($data, array_flip($writable));
    }
}
