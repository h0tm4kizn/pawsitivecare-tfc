<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Owner;
use App\Models\User;
use App\Models\Pet;
use App\Http\Requests\StoreOwnerRequest;
use App\Http\Requests\StoreOwnerWithPetRequest;
use App\Http\Requests\UpdateOwnerRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use App\Mail\WelcomeMail;

class OwnerController extends Controller
{
    private function buildAddressFromParts(array $input): ?string
    {
        $unit = trim((string)($input['address_unit_floor'] ?? ''));
        $street = trim((string)($input['address_street'] ?? ''));
        $barangay = trim((string)($input['address_barangay'] ?? ''));
        $city = trim((string)($input['address_city'] ?? ''));
        $province = trim((string)($input['address_province'] ?? ''));
        $postal = trim((string)($input['address_postal_code'] ?? ''));
        $country = strtoupper(trim((string)($input['address_country'] ?? 'PH')));

        $line1 = implode(', ', array_filter([$unit, $street]));
        $line2Parts = array_filter([
            $barangay ? "Brgy. {$barangay}" : null,
            $city,
            $province,
            $postal,
        ]);
        $line2 = implode(', ', $line2Parts);
        $address = implode(', ', array_filter([$line1, $line2, $country]));

        return $address !== '' ? $address : null;
    }
    /**
     * Admin dashboard: return paginated owners with pets and species/breed data.
     * Supports optional ?search= filter and ?per_page=
     * GET /admin/owners?page=1&per_page=20&search=
     * 
     * OPTIMIZED: Uses column selection in eager loads to reduce data transfer
     */
    private static function ownerVersion(): int
    {
        return (int) Cache::get('owners:version', 0);
    }

    private static function touchOwnerVersion(): void
    {
        Cache::put('owners:version', now()->timestamp, 3600);
    }

    public function adminIndex(Request $request)
    {
        $this->authorize('viewAny', Owner::class);
        // Schema checks cached for 24 h — columns never change at runtime.
        $hasDeactivationReason = Cache::remember('schema:owners:deactivation_reason', 86400, fn() => Schema::hasColumn('owners', 'deactivation_reason'));
        $hasDeletionReason     = Cache::remember('schema:owners:deletion_reason',     86400, fn() => Schema::hasColumn('owners', 'deletion_reason'));
        $hasEcRelationship     = Cache::remember('schema:owners:ec_relationship',     86400, fn() => Schema::hasColumn('owners', 'ec_relationship'));
        $selectColumns = ['id', 'display_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'address_unit_floor', 'address_street', 'address_barangay', 'address_city', 'address_province', 'address_postal_code', 'address_country', 'is_active', 'created_at', 'ec_first_name', 'ec_last_name', 'ec_email', 'ec_phone'];
        if ($hasEcRelationship)     $selectColumns[] = 'ec_relationship';
        if ($hasDeactivationReason) $selectColumns[] = 'deactivation_reason';
        if ($hasDeletionReason)     $selectColumns[] = 'deletion_reason';

        $term    = trim((string) ($request->query('search', $request->query('q', ''))));
        $perPage = min((int) $request->query('per_page', 20), 100);
        $page    = (int) $request->query('page', 1);

        $cacheKey = 'owners:admin:' . self::ownerVersion() . ':' . md5($term . ':' . $page . ':' . $perPage);
        $result   = Cache::remember($cacheKey, 180, function () use ($selectColumns, $term, $perPage, $hasDeactivationReason, $hasDeletionReason, $hasEcRelationship) {
            $query = Owner::select($selectColumns)
                ->with([
                    'pets' => fn($q) => $q->select('id', 'owner_id', 'pet_id', 'name', 'species_id', 'breed_id', 'sex', 'date_of_birth', 'photo_url'),
                    'pets.speciesType' => fn($q) => $q->select('id', 'name'),
                    'pets.breed' => fn($q) => $q->select('id', 'name', 'species_id'),
                ])
                ->latest();

            if ($term !== '') {
                $needle = '%' . mb_strtolower($term) . '%';
                $query->where(function ($q) use ($needle) {
                    $q->whereRaw('LOWER(first_name) LIKE ?', [$needle])
                      ->orWhereRaw('LOWER(last_name) LIKE ?', [$needle])
                      ->orWhereRaw("LOWER(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) LIKE ?", [$needle])
                      ->orWhereRaw("LOWER(CONCAT(COALESCE(last_name, ''), ' ', COALESCE(first_name, ''))) LIKE ?", [$needle])
                      ->orWhereRaw('LOWER(email) LIKE ?', [$needle])
                      ->orWhereRaw('LOWER(phone) LIKE ?', [$needle])
                      ->orWhereRaw('LOWER(display_id) LIKE ?', [$needle]);
                });
            }

            $paginated = $query->paginate($perPage);
            $owners    = $paginated->getCollection()->map(function ($owner) use ($hasDeactivationReason, $hasDeletionReason, $hasEcRelationship) {
                return [
                    'id'         => $owner->id,
                    'display_id' => $owner->display_id,
                    'first_name' => $owner->first_name,
                    'last_name'  => $owner->last_name,
                    'email'      => $owner->email,
                    'phone'      => $owner->phone,
                    'address'    => $owner->address,
                    'address_unit_floor'  => $owner->address_unit_floor,
                    'address_street'      => $owner->address_street,
                    'address_barangay'    => $owner->address_barangay,
                    'address_city'        => $owner->address_city,
                    'address_province'    => $owner->address_province,
                    'address_postal_code' => $owner->address_postal_code,
                    'address_country'     => $owner->address_country,
                    'is_active'  => (bool) $owner->is_active,
                    'ec_first_name'  => $owner->ec_first_name,
                    'ec_last_name'   => $owner->ec_last_name,
                    'ec_email'       => $owner->ec_email,
                    'ec_phone'       => $owner->ec_phone,
                    'deactivation_reason' => $hasDeactivationReason ? ($owner->deactivation_reason ?? null) : null,
                    'deletion_reason'     => $hasDeletionReason ? ($owner->deletion_reason ?? null) : null,
                    'created_at'          => $owner->created_at,
                    'ec_relationship'     => $hasEcRelationship ? ($owner->ec_relationship ?? null) : null,
                    'pets' => $owner->pets->map(fn ($pet) => [
                        'id'            => $pet->id,
                        'pet_id'        => $pet->pet_id,
                        'name'          => $pet->name,
                        'species_type'  => $pet->speciesType ? ['id' => $pet->speciesType->id, 'name' => $pet->speciesType->name] : null,
                        'breed'         => $pet->breed ? ['id' => $pet->breed->id, 'name' => $pet->breed->name] : null,
                        'sex'           => $pet->sex,
                        'date_of_birth' => $pet->date_of_birth?->toDateString(),
                        'age'           => $pet->age,
                        'owner_id'      => $pet->owner_id,
                        'photo_url'     => $pet->photo_url,
                    ])->toArray(),
                ];
            });

            return $paginated->setCollection(collect($owners));
        });

        return $this->success($result, 'Owners retrieved successfully.');
    }

    /**
     * List all owners (paginated).
     * Admin + Staff: see all owners.
     * GET /owners?page=1&per_page=20&search=
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Owner::class);

        $hasDeactivationReason = Cache::remember('schema:owners:deactivation_reason', 86400, fn() => Schema::hasColumn('owners', 'deactivation_reason'));
        $hasDeletionReason     = Cache::remember('schema:owners:deletion_reason',     86400, fn() => Schema::hasColumn('owners', 'deletion_reason'));
        $hasEcRelationship     = Cache::remember('schema:owners:ec_relationship',     86400, fn() => Schema::hasColumn('owners', 'ec_relationship'));

        $indexColumns = ['id', 'display_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'address_unit_floor', 'address_street', 'address_barangay', 'address_city', 'address_province', 'address_postal_code', 'address_country', 'is_active', 'ec_first_name', 'ec_last_name', 'ec_email', 'ec_phone', 'created_at'];
        if ($hasEcRelationship)     $indexColumns[] = 'ec_relationship';
        if ($hasDeactivationReason) $indexColumns[] = 'deactivation_reason';
        if ($hasDeletionReason)     $indexColumns[] = 'deletion_reason';

        $term    = trim((string) ($request->query('search', $request->query('q', ''))));
        $perPage = min((int) $request->query('per_page', 20), 100);
        $page    = (int) $request->query('page', 1);

        $cacheKey = 'owners:index:' . self::ownerVersion() . ':' . md5($term . ':' . $page . ':' . $perPage);
        $result   = Cache::remember($cacheKey, 180, function () use ($indexColumns, $term, $perPage, $hasDeactivationReason, $hasDeletionReason, $hasEcRelationship) {
            $query = Owner::select($indexColumns)
                ->with([
                    'pets' => fn($q) => $q->select('id', 'owner_id', 'pet_id', 'name', 'species_id', 'breed_id', 'sex', 'date_of_birth', 'photo_url'),
                    'pets.speciesType' => fn($q) => $q->select('id', 'name'),
                    'pets.breed' => fn($q) => $q->select('id', 'name', 'species_id'),
                ])
                ->latest();

            if ($term !== '') {
                $normalizedSearch = preg_replace('/\s+/', ' ', mb_strtolower($term));
                $words = array_values(array_filter(explode(' ', $normalizedSearch)));
                $needle = '%' . $normalizedSearch . '%';
                $phoneDigits = preg_replace('/\D+/', '', $term);

                $query->where(function ($q) use ($words, $needle, $phoneDigits) {
                    if (count($words) > 1) {
                        $q->where(function ($sub) use ($words) {
                            $sub->where('first_name', 'LIKE', '%' . $words[0] . '%')
                                ->where('last_name', 'LIKE', '%' . $words[1] . '%');
                        })->orWhere(function ($sub) use ($words) {
                            $sub->where('first_name', 'LIKE', '%' . $words[1] . '%')
                                ->where('last_name', 'LIKE', '%' . $words[0] . '%');
                        });
                    } else {
                        $q->where('first_name', 'LIKE', $needle)
                          ->orWhere('last_name', 'LIKE', $needle);
                    }

                    $q->orWhere('email', 'LIKE', $needle)
                      ->orWhere('phone', 'LIKE', $needle)
                      ->orWhere('display_id', 'LIKE', $needle);

                    if ($phoneDigits !== '') {
                        $q->orWhere('phone', 'LIKE', '%' . $phoneDigits . '%');
                    }
                });
            }

            $paginated = $query->paginate($perPage);
            $owners    = $paginated->getCollection()->map(function ($owner) use ($hasDeactivationReason, $hasDeletionReason, $hasEcRelationship) {
                return [
                    'id'         => $owner->id,
                    'display_id' => $owner->display_id,
                    'first_name' => $owner->first_name,
                    'last_name'  => $owner->last_name,
                    'email'      => $owner->email,
                    'phone'      => $owner->phone,
                    'address'    => $owner->address,
                    'address_unit_floor'  => $owner->address_unit_floor,
                    'address_street'      => $owner->address_street,
                    'address_barangay'    => $owner->address_barangay,
                    'address_city'        => $owner->address_city,
                    'address_province'    => $owner->address_province,
                    'address_postal_code' => $owner->address_postal_code,
                    'address_country'     => $owner->address_country,
                    'is_active'      => (bool) $owner->is_active,
                    'ec_first_name'  => $owner->ec_first_name,
                    'ec_last_name'   => $owner->ec_last_name,
                    'ec_email'       => $owner->ec_email,
                    'ec_phone'       => $owner->ec_phone,
                    'deactivation_reason' => $hasDeactivationReason ? ($owner->deactivation_reason ?? null) : null,
                    'deletion_reason'     => $hasDeletionReason ? ($owner->deletion_reason ?? null) : null,
                    'created_at'          => $owner->created_at,
                    'ec_relationship'     => $hasEcRelationship ? ($owner->ec_relationship ?? null) : null,
                    'pets' => $owner->pets->map(fn ($pet) => [
                        'id'            => $pet->id,
                        'pet_id'        => $pet->pet_id,
                        'name'          => $pet->name,
                        'species_type'  => $pet->speciesType ? ['id' => $pet->speciesType->id, 'name' => $pet->speciesType->name] : null,
                        'breed'         => $pet->breed ? ['id' => $pet->breed->id, 'name' => $pet->breed->name] : null,
                        'sex'           => $pet->sex,
                        'date_of_birth' => $pet->date_of_birth,
                        'owner_id'      => $pet->owner_id,
                        'photo_url'     => $pet->photo_url,
                    ])->toArray(),
                ];
            });

            return $paginated->setCollection(collect($owners));
        });

        return $this->success($result, 'Owners retrieved successfully.');
    }

    /**
     * Show a single owner.
     * Admin + Staff: any owner. Customer: own profile only.
     * GET /owners/{owner}
     */
    public function show(Owner $owner)
    {
        $this->authorize('view', $owner);

        $owner->load(['pets.breed', 'pets.speciesType']);

        return $this->success([
            'id'            => $owner->id,
            'display_id'    => $owner->display_id,
            'first_name'    => $owner->first_name,
            'last_name'     => $owner->last_name,
            'email'         => $owner->email,
            'phone'         => $owner->phone,
            'address'       => $owner->address,
            'address_unit_floor' => $owner->address_unit_floor,
            'address_street' => $owner->address_street,
            'address_barangay' => $owner->address_barangay,
            'address_city' => $owner->address_city,
            'address_province' => $owner->address_province,
            'address_postal_code' => $owner->address_postal_code,
            'address_country' => $owner->address_country,
            'is_active'     => (bool) $owner->is_active,
            'deactivation_reason' => $owner->deactivation_reason,
            'deletion_reason'     => $owner->deletion_reason,
            'created_at'    => $owner->created_at,
            'ec_first_name' => $owner->ec_first_name,
            'ec_last_name'  => $owner->ec_last_name,
            'ec_email'      => $owner->ec_email,
            'ec_phone'      => $owner->ec_phone,
            'ec_relationship' => $owner->ec_relationship ?? null,
            'pets' => $owner->pets->map(fn ($pet) => [
                'id'            => $pet->id,
                'pet_id'      => $pet->pet_id,
                'name'          => $pet->name,
                'species_type'  => $pet->speciesType ? ['id' => $pet->speciesType->id, 'name' => $pet->speciesType->name] : null,
                'breed'         => $pet->breed ? ['id' => $pet->breed->id, 'name' => $pet->breed->name] : null,
                'sex'           => $pet->sex,
                'date_of_birth' => $pet->date_of_birth?->toDateString(),
                'weight_kg'     => $pet->weight_kg,
                'medical_notes' => $pet->medical_notes,
                'photo_url'     => $pet->photo_url,
                'identification_hash' => $pet->identification_hash,
                'identification_image_url' => $pet->identification_image_url,
                'recognition_registered' => (bool) ($pet->recognition_registered ?? false),
                'recognition_registered_at' => $pet->recognition_registered_at,
                'owner_id'      => $pet->owner_id,
            ])->toArray(),
        ], 'Owner retrieved successfully.');
    }

    /**
     * Create a new owner.
     * Admin + Staff only.
     * POST /owners
     */
    public function store(StoreOwnerRequest $request)
    {
        $this->authorize('create', Owner::class);

        $validated = $request->validated();
        if (empty($validated['address'])) {
            $validated['address'] = $this->buildAddressFromParts($validated);
        }

        $owner = DB::transaction(function () use ($validated) {
            $ownerData = $validated;
            $plainPassword = $ownerData['password'] ?? null;
            unset($ownerData['password']);

            if (!empty($plainPassword)) {
                $user = User::create([
                    'name'          => trim(($ownerData['first_name'] ?? '') . ' ' . ($ownerData['last_name'] ?? '')),
                    'email'         => $ownerData['email'],
                    'phone'         => $ownerData['phone'] ?? null,
                    'password_hash' => Hash::make($plainPassword),
                    'role'          => 'customer',
                    'is_active'     => true,
                    // Accounts created by authorized staff/admin are already
                    // verified through the in-person onboarding process.
                    'email_verified_at' => now('Asia/Manila'),
                ]);

                $ownerData['user_id'] = $user->id;
            }

            return Owner::create($ownerData);
        });

        self::touchOwnerVersion();
        return $this->success($owner, 'Owner created successfully.', 201);
    }

    /**
     * Create owner + first pet atomically.
     * Admin only.
     * POST /admin/owners-with-pet
     */
    public function storeWithPet(StoreOwnerWithPetRequest $request)
    {
        $this->authorize('create', Owner::class);

        $validated = $request->validated();

        $result = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name'          => trim($validated['first_name'] . ' ' . $validated['last_name']),
                'email'         => $validated['email'],
                'phone'         => $validated['phone'] ?? null,
                'password_hash' => Hash::make($validated['password']),
                'role'          => 'customer',
                'is_active'     => true,
                'email_verified_at' => now('Asia/Manila'),
            ]);

            $owner = Owner::create([
                'user_id'           => $user->id,
                'first_name'        => $validated['first_name'],
                'last_name'         => $validated['last_name'],
                'email'             => $validated['email'],
                'phone'             => $validated['phone'],
                'address'           => $validated['address'] ?? null,
                'address_unit_floor'=> $validated['address_unit_floor'] ?? null,
                'address_street'    => $validated['address_street'] ?? null,
                'address_barangay'  => $validated['address_barangay'] ?? null,
                'address_city'      => $validated['address_city'] ?? null,
                'address_province'  => $validated['address_province'] ?? null,
                'address_postal_code'=> $validated['address_postal_code'] ?? null,
                'address_country'   => $validated['address_country'] ?? 'PH',
                'preferred_contact' => $validated['preferred_contact'],
                'ec_first_name'     => $validated['ec_first_name'] ?? null,
                'ec_last_name'      => $validated['ec_last_name'] ?? null,
                'ec_email'          => $validated['ec_email'] ?? null,
                'ec_phone'          => $validated['ec_phone'] ?? null,
                'ec_relationship'   => $validated['ec_relationship'] ?? null,
            ]);

            $pet = Pet::create([
                'owner_id'      => $owner->id,
                'name'          => $validated['pet_name'],
                'species_id'    => $validated['species_id'],
                'breed_id'      => $validated['breed_id'],
                'sex'           => $validated['pet_sex'],
                'date_of_birth' => $validated['pet_dob'] ?? null,
                'weight_kg'     => $validated['weight_kg'] ?? null,
                'medical_notes' => $validated['medical_notes'] ?? null,
            ]);

            return compact('owner', 'pet', 'user');
        });

        // Keep registration successful even if SMTP is down.
        try {
            Mail::to($result['user']->email)->send(new WelcomeMail($result['user'], $result['owner'], $result['pet']));
        } catch (\Throwable $e) {
            report($e);
        }

        self::touchOwnerVersion();
        return $this->success([
            'owner' => $result['owner'],
            'pet'   => $result['pet'],
            'user'  => [
                'id'    => $result['user']->id,
                'email' => $result['user']->email,
                'role'  => $result['user']->role,
            ],
        ], 'Owner and pet registered successfully.', 201);
    }

    /**
     * Update an existing owner.
     * Admin + Staff: any owner. Customer: own profile only.
     * PUT/PATCH /owners/{owner}
     */
    public function update(UpdateOwnerRequest $request, Owner $owner)
    {
        $this->authorize('update', $owner);

        $validated = $request->validated();
        if (
            (!array_key_exists('address', $validated) || $validated['address'] === null || trim((string)$validated['address']) === '')
            && (
                array_key_exists('address_unit_floor', $validated) ||
                array_key_exists('address_street', $validated) ||
                array_key_exists('address_barangay', $validated) ||
                array_key_exists('address_city', $validated) ||
                array_key_exists('address_province', $validated) ||
                array_key_exists('address_postal_code', $validated) ||
                array_key_exists('address_country', $validated)
            )
        ) {
            $validated['address'] = $this->buildAddressFromParts($validated);
        }
        if (!Schema::hasColumn('owners', 'deactivation_reason')) {
            unset($validated['deactivation_reason']);
        }
        if (!Schema::hasColumn('owners', 'deletion_reason')) {
            unset($validated['deletion_reason']);
        }
        $owner->update($validated);

        // If owner has a linked user account, update user info too
        if ($owner->user_id && $owner->user) {
            $userUpdates = [];
            if (isset($validated['email'])) $userUpdates['email'] = $validated['email'];
            if (isset($validated['phone'])) $userUpdates['phone'] = $validated['phone'];
            if (isset($validated['is_active'])) $userUpdates['is_active'] = $validated['is_active'];

            // users table stores full name in `name`, not first_name/last_name
            $nextFirstName = $validated['first_name'] ?? $owner->first_name;
            $nextLastName = $validated['last_name'] ?? $owner->last_name;
            if ($nextFirstName || $nextLastName) {
                $userUpdates['name'] = trim(($nextFirstName ?? '') . ' ' . ($nextLastName ?? ''));
            }
            
            if (!empty($userUpdates)) {
                $owner->user->update($userUpdates);
            }
        }

        self::touchOwnerVersion();
        return $this->success($owner, 'Owner updated successfully.');
    }

    /**
     * Get the authenticated customer's own owner profile.
     * GET /my-profile
     */
    public function myProfile(Request $request)
    {
        $user  = $request->user();
        $owner = $user->owner;

        // Fallback: admin-created owners have no user_id — match by email and auto-link
        if (!$owner) {
            $owner = Owner::where('email', $user->email)->first();
            if ($owner) $owner->update(['user_id' => $user->id]);
        }

        if (!$owner) {
            return $this->error('Owner profile not found.', 404);
        }

        $ownerWithPets = $owner->load('pets');
        $ownerWithPets->setAttribute('totp_enabled', (bool) ($user->totp_enabled ?? false));
        $ownerWithPets->setAttribute('totp_confirmed_at', $user->totp_confirmed_at ?? null);
        $ownerWithPets->setAttribute('two_factor_enabled', (bool) ($user->totp_enabled ?? false));
        $ownerWithPets->setAttribute('has_recovery_codes', !empty($user->totp_recovery_codes));

        return $this->success($ownerWithPets, 'Profile retrieved successfully.');
    }

    /**
     * Update the authenticated customer's own owner profile.
     * PUT /my-profile
     */
    public function updateMyProfile(UpdateOwnerRequest $request)
    {
        $user  = $request->user();
        $owner = $user->owner;

        // Fallback: admin-created owners have no user_id — match by email and auto-link
        if (!$owner) {
            $owner = Owner::where('email', $user->email)->first();
            if ($owner) $owner->update(['user_id' => $user->id]);
        }

        if (!$owner) {
            return $this->error('Owner profile not found.', 404);
        }

        $this->authorize('update', $owner);

        $validated = $request->validated();
        if (
            (!array_key_exists('address', $validated) || $validated['address'] === null || trim((string)$validated['address']) === '')
            && (
                array_key_exists('address_unit_floor', $validated) ||
                array_key_exists('address_street', $validated) ||
                array_key_exists('address_barangay', $validated) ||
                array_key_exists('address_city', $validated) ||
                array_key_exists('address_province', $validated) ||
                array_key_exists('address_postal_code', $validated) ||
                array_key_exists('address_country', $validated)
            )
        ) {
            $validated['address'] = $this->buildAddressFromParts($validated);
        }

        $owner->update($validated);

        return $this->success($owner, 'Profile updated successfully.');
    }

    public function checkPassword(Request $request)
    {
        $request->validate(['current_password' => 'required|string']);
        if (!\Hash::check($request->current_password, $request->user()->password_hash)) {
            return $this->error('Current password is incorrect.', 422);
        }
        return $this->success(null, 'Password is correct.');
    }

    /**
     * Change the authenticated customer's password.
     * PUT /my-profile/change-password
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed',
        ]);

        if (!\Hash::check($request->current_password, $user->password_hash)) {
            return $this->error('Current password is incorrect.', 422);
        }

        $user->update(['password_hash' => \Hash::make($request->password)]);

        // Security hardening: revoke trusted devices after password change.
        DB::table('user_trusted_devices')->where('user_id', $user->id)->delete();

        // Revoke other active tokens, keep current token to avoid abrupt logout mid-request.
        $currentToken = $user->currentAccessToken();
        if ($currentToken) {
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $user->id)
                ->where('id', '!=', $currentToken->id)
                ->delete();
        } else {
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $user->id)
                ->delete();
        }

        return $this->success(null, 'Password changed successfully.');
    }

    /**
     * List the authenticated customer's trusted devices.
     * GET /my-profile/trusted-devices
     */
    public function listTrustedDevices(Request $request)
    {
        $user = $request->user();
        $rows = DB::table('user_trusted_devices')
            ->where('user_id', $user->id)
            ->orderByDesc('last_used_at')
            ->get(['id', 'device_id', 'first_ip', 'last_ip', 'trusted_until', 'last_used_at', 'created_at']);

        return $this->success($rows, 'Trusted devices retrieved.');
    }

    /**
     * Revoke one trusted device by device id.
     * DELETE /my-profile/trusted-devices/{deviceId}
     */
    public function revokeTrustedDevice(Request $request, string $deviceId)
    {
        $user = $request->user();

        if (mb_strlen($deviceId) > 120) {
            return $this->error('Invalid device id.', 422);
        }

        $deleted = DB::table('user_trusted_devices')
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->delete();

        if ($deleted === 0) {
            return $this->error('Trusted device not found.', 404);
        }

        return $this->success(null, 'Trusted device revoked.');
    }

    /**
     * Revoke all trusted devices.
     * DELETE /my-profile/trusted-devices
     */
    public function revokeAllTrustedDevices(Request $request)
    {
        $user = $request->user();
        DB::table('user_trusted_devices')->where('user_id', $user->id)->delete();
        return $this->success(null, 'All trusted devices revoked.');
    }

    /**
     * Delete an owner.
     * Admin only.
     * DELETE /owners/{owner}
     */
    public function destroy(Owner $owner)
    {
        $this->authorize('delete', $owner);

        // If owner has a linked user account, delete it too
        if ($owner->user_id && $owner->user) {
            $owner->user->delete();
        }

        $owner->delete();

        self::touchOwnerVersion();
        return $this->success(null, 'Owner deleted successfully.');
    }
}
