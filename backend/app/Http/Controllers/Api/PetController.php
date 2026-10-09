<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Owner;
use App\Models\User;
use App\Models\Pet;
use App\Http\Requests\StorePetRequest;
use App\Http\Requests\UpdatePetRequest;
use App\Mail\NewPetRegisteredMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;

class PetController extends Controller
{
    /**
     * Admin dashboard: paginated, filterable pet list.
     * Returns { pets: [...], total_pages, total, current_page }
     */
    public function adminIndex(Request $request)
    {
        $this->authorize('viewAny', Pet::class);

        $baseColumns = [
                'id',
                'owner_id',
                'species_id',
                'breed_id',
                'name',
                'sex',
                'date_of_birth',
                'weight_kg',
                'photo_url',
                'identification_hash',
                'identification_image_url',
                'recognition_registered',
                'recognition_registered_at',
                'is_active',
                'deactivation_reason',
                'deletion_reason',
                'created_at',
                'pet_id',
            ];

        $query = Pet::select($baseColumns)
            ->with([
                'owner:id,display_id,first_name,last_name,email,phone,address',
                'speciesType:id,name,code',
                'breed:id,name,species_id',
                'recognitionPhotos:id,pet_id,photo_url,image_hash,captured_at',
            ])
            ->latest();

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('name', 'LIKE', '%' . $term . '%')
                  ->orWhere('pet_id', 'LIKE', '%' . $term . '%');
            });
        }

        if ($request->filled('type')) {
            $query->whereHas('speciesType', fn ($q) => $q->where('name', $request->type));
        }

        if ($request->filled('breed')) {
            $query->whereHas('breed', fn ($q) => $q->where('name', $request->breed));
        }

        if ($request->filled('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }

        $perPage = 15;
        $paginated = $query->paginate($perPage, ['*'], 'page', $request->get('page', 1));

        $pets = $paginated->getCollection()->map(fn ($pet) => [
            'id'           => $pet->id,
            'pet_id'     => $pet->pet_id,
            'name'         => $pet->name,
            'species_type' => $pet->speciesType ? ['id' => $pet->speciesType->id, 'name' => $pet->speciesType->name, 'code' => $pet->speciesType->code] : null,
            'breed'        => $pet->breed ? ['id' => $pet->breed->id, 'name' => $pet->breed->name] : null,
            'sex'          => $pet->sex,
            'date_of_birth'=> $pet->date_of_birth?->toDateString(),
            'age'          => $pet->age,
            'weight_kg'    => $pet->weight_kg,
            'created_at'   => $pet->created_at?->toDateString(),
            'owner_id'     => $pet->owner_id,
            'owner'        => $pet->owner,
            'photo_url'    => $pet->photo_url,
            'identification_hash' => $pet->identification_hash,
            'identification_image_url' => $pet->identification_image_url,
            'recognition_registered' => (bool) ($pet->recognition_registered ?? false),
            'recognition_registered_at' => $pet->recognition_registered_at,
            'is_active'    => (bool) ($pet->is_active ?? true),
            'deactivation_reason' => $pet->deactivation_reason ?? null,
            'deletion_reason'     => $pet->deletion_reason ?? null,
            'recognition_photos' => $pet->recognitionPhotos->map(fn ($photo) => [
                'id' => $photo->id, 'photo_url' => $photo->photo_url, 'captured_at' => $photo->captured_at,
            ])->values(),
        ]);

        return $this->success([
            'pets'         => $pets,
            'total_pages'  => $paginated->lastPage(),
            'total'        => $paginated->total(),
            'current_page' => $paginated->currentPage(),
        ], 'Pets retrieved successfully.');
    }

    /**
     * List all pets.
     * Admin + Staff: see all pets.
     * Customer: sees only their own pets.
     * GET /pets
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Pet::class);

        /** @var User $user */
        $user = $request->user();
        $baseColumns = [
            'id',
            'owner_id',
            'species_id',
            'breed_id',
            'name',
            'sex',
            'date_of_birth',
            'weight_kg',
                'medical_notes',
            'photo_url',
            'identification_hash',
            'identification_image_url',
            'recognition_registered',
            'recognition_registered_at',
            'created_at',
            'pet_id',
        ];

        if ($user->isCustomer()) {
            // Primary: match via user_id relationship
            // Fallback: match via email (handles admin-created owners with no user_id)
            $ownerId = $this->resolveOwnerIdForUser($user);

            $pets = Pet::select($baseColumns)
                ->with([
                    'owner:id,display_id,first_name,last_name,email,phone,address',
                    'speciesType:id,name,code',
                    'breed:id,name,species_id',
                    'recognitionPhotos:id,pet_id,photo_url,captured_at',
                ])
                ->where('owner_id', $ownerId)
                ->when($request->filled('start_date'), fn ($query) => $query->whereDate('created_at', '>=', $request->query('start_date')))
                ->when($request->filled('end_date'), fn ($query) => $query->whereDate('created_at', '<=', $request->query('end_date')))
                ->oldest()
                ->get();
        } else {
            $query = Pet::select($baseColumns)
                ->with([
                    'owner:id,display_id,first_name,last_name,email,phone,address',
                    'speciesType:id,name,code',
                    'breed:id,name,species_id',
                    'recognitionPhotos:id,pet_id,photo_url,captured_at',
                ])
                ->latest();

            // Reports request a monthly date range. Apply it here as well so
            // the detailed breed list matches the report summary totals.
            if ($request->filled('start_date')) {
                $query->whereDate('created_at', '>=', $request->query('start_date'));
            }
            if ($request->filled('end_date')) {
                $query->whereDate('created_at', '<=', $request->query('end_date'));
            }

            if ($request->filled('owner_id')) {
                $query->where('owner_id', $request->query('owner_id'));
            }

            $search = trim((string) ($request->query('search', $request->query('q', ''))));
            if ($search !== '') {
                $normalizedSearch = preg_replace('/\s+/', ' ', mb_strtolower($search));
                $words = array_values(array_filter(explode(' ', $normalizedSearch)));
                $needle = '%' . $normalizedSearch . '%';
                $phoneDigits = preg_replace('/\D+/', '', $search);

                $query->where(function ($q) use ($words, $needle, $phoneDigits) {
                    $q->where('name', 'LIKE', $needle)
                      ->orWhere('pet_id', 'LIKE', $needle);

                    $q->orWhereHas('owner', function ($oq) use ($words, $needle, $phoneDigits) {
                        if (count($words) > 1) {
                            $oq->where(function ($sub) use ($words) {
                                $sub->where('first_name', 'LIKE', '%' . $words[0] . '%')
                                    ->where('last_name', 'LIKE', '%' . $words[1] . '%');
                            })->orWhere(function ($sub) use ($words) {
                                $sub->where('first_name', 'LIKE', '%' . $words[1] . '%')
                                    ->where('last_name', 'LIKE', '%' . $words[0] . '%');
                            });
                        } else {
                            $oq->where('first_name', 'LIKE', $needle)
                              ->orWhere('last_name', 'LIKE', $needle);
                        }
                        $oq->orWhere('email', 'LIKE', $needle)
                           ->orWhere('phone', 'LIKE', $needle)
                           ->orWhere('display_id', 'LIKE', $needle);

                        if ($phoneDigits !== '') {
                            $oq->orWhere('phone', 'LIKE', '%' . $phoneDigits . '%');
                        }
                    });

                    $q->orWhereHas('breed', function ($bq) use ($needle) {
                        $bq->where('name', 'LIKE', $needle);
                    });
                });
            }

            if ($request->has('per_page') || $request->has('page')) {
                $perPage = max(1, min((int) $request->query('per_page', 200), 500));
                $page = max(1, (int) $request->query('page', 1));
                $pets = $query->paginate($perPage, ['*'], 'page', $page);
            } else {
                $pets = $query->get();
            }
        }

        return $this->success($pets, 'Pets retrieved successfully.');
    }

    /**
     * Show a single pet.
     * GET /pets/{pet}
     */
    public function show(Pet $pet)
    {
        $this->authorize('view', $pet);

        return $this->success(
            $pet->load(['owner', 'speciesType', 'breed', 'recognitionPhotos:id,pet_id,photo_url,captured_at']),
            'Pet retrieved successfully.'
        );
    }

    /**
     * Create a new pet.
     * Admin + Staff only.
     * POST /pets
     */
    public function store(StorePetRequest $request)
    {
        $this->authorize('create', Pet::class);

        $pet = Pet::create($request->validated());
        $pet->refresh()->load(['owner', 'speciesType', 'breed']);

        try {
            if ($pet->owner_id) {
                $species = $pet->speciesType?->name ?? '';
                Notification::create([
                    'owner_id'  => $pet->owner_id,
                    'subject'   => 'New Pet Registered',
                    'message'   => 'Your pet ' . $pet->name . ($species ? ' (' . $species . ')' : '') . ' has been successfully registered!',
                    'type'      => 'new_pet',
                    'channel'   => 'in_app',
                    'status'    => 'sent',
                    'is_read'   => false,
                    'sent_at'   => now('Asia/Manila'),
                    'metadata'  => ['pet_id' => $pet->id, 'pet_name' => $pet->name],
                ]);

                if (!empty($pet->owner?->email)) {
                    Mail::to($pet->owner->email)->send(new NewPetRegisteredMail($pet, $pet->owner));
                }
            }
        } catch (\Exception $e) {
            \Log::warning('Pet notification creation failed: ' . $e->getMessage());
        }

        return $this->success($pet, 'Pet created successfully.', 201);
    }

    /**
     * Customer registers their own pet.
     * POST /my-pets
     */
    public function storeOwn(Request $request)
    {
        $user  = $request->user();
        $owner = $this->resolveOwnerForUser($user);

        // Owner resolved via relationship or email fallback helper.
        if (!$owner) {
            return $this->error('Owner profile not found.', 422);
        }

        $validated = $request->validate([
            'name'          => 'required|string|max:100',
            'species_id'    => 'required|uuid|exists:species_types,id',
            'breed_id'      => 'nullable|uuid|exists:breeds,id',
            'sex'           => 'required|in:male,female',
            'date_of_birth' => 'nullable|date|before_or_equal:today',
            'weight_kg'     => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
            'medical_notes' => 'nullable|string',
        ]);

        $pet = Pet::create(array_merge($validated, ['owner_id' => $owner->id]));
        $pet->refresh()->load(['owner', 'speciesType', 'breed']);

        try {
            $species = $pet->speciesType?->name ?? '';
            Notification::create([
                'owner_id'  => $owner->id,
                'subject'   => 'New Pet Registered',
                'message'   => 'Your pet ' . $pet->name . ($species ? ' (' . $species . ')' : '') . ' has been successfully registered!',
                'type'      => 'new_pet',
                'channel'   => 'in_app',
                'status'    => 'sent',
                'is_read'   => false,
                'sent_at'   => now('Asia/Manila'),
                'metadata'  => ['pet_id' => $pet->id, 'pet_name' => $pet->name],
            ]);

            if (!empty($owner->email)) {
                Mail::to($owner->email)->send(new NewPetRegisteredMail($pet, $owner));
            }

            // Fire a breed request notification when the customer used "Other" breed
            $notes = $pet->medical_notes ?? '';
            if (str_starts_with($notes, 'Other Breed:')) {
                $customBreed = trim(substr($notes, strlen('Other Breed:')));
                $ownerName   = trim($owner->first_name . ' ' . $owner->last_name);
                Notification::create([
                    'owner_id' => $owner->id,
                    'subject'  => 'New Breed Request',
                    'message'  => $ownerName . ' registered ' . $pet->name . ' with an unlisted breed: "' . $customBreed . '".',
                    'type'     => 'breed_request',
                    'channel'  => 'in_app',
                    'status'   => 'sent',
                    'is_read'  => false,
                    'sent_at'  => now('Asia/Manila'),
                    'metadata' => [
                        'pet_id'       => $pet->id,
                        'pet_name'     => $pet->name,
                        'owner_name'   => $ownerName,
                        'custom_breed' => $customBreed,
                        'species_id'   => $pet->species_id,
                        'species_name' => $species,
                    ],
                ]);
            }
        } catch (\Exception $e) {
            \Log::warning('Pet notification creation failed: ' . $e->getMessage());
        }

        return $this->success($pet, 'Pet registered successfully.', 201);
    }

    /**
     * Customer updates their own pet.
     * PUT /my-pets/{pet}
     */
    public function updateOwn(Request $request, Pet $pet)
    {
        $user  = $request->user();
        $owner = $this->resolveOwnerForUser($user);

        if (!$owner || $pet->owner_id !== $owner->id) {
            return $this->error('Unauthorized.', 403);
        }

        $validated = $request->validate([
            'name'          => 'sometimes|string|max:100',
            'species_id'    => 'sometimes|uuid|exists:species_types,id',
            'breed_id'      => 'sometimes|uuid|exists:breeds,id',
            'sex'           => 'sometimes|in:male,female',
            'date_of_birth' => 'nullable|date|before_or_equal:today',
            'weight_kg'     => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
            'medical_notes' => 'nullable|string',
        ]);

        $pet->update($validated);

        return $this->success(
            $pet->load(['owner', 'speciesType', 'breed']),
            'Pet updated successfully.'
        );
    }

    /**
     * Update an existing pet.
     * Admin + Staff only.
     * PUT/PATCH /pets/{pet}
     */
    public function update(UpdatePetRequest $request, Pet $pet)
    {
        $this->authorize('update', $pet);

        $data = $request->validated();

        if (array_key_exists('is_active', $data) && !$data['is_active']) {
            $reason = trim((string) ($data['deactivation_reason'] ?? $data['action_reason'] ?? ''));
            if ($reason === '') {
                return $this->error('Reason is required when deactivating a pet.', 422);
            }
            if (Schema::hasColumn('pets', 'deactivation_reason')) {
                $data['deactivation_reason'] = $reason;
            }
        }

        if (array_key_exists('is_active', $data) && $data['is_active'] && Schema::hasColumn('pets', 'deactivation_reason')) {
            $data['deactivation_reason'] = null;
        }

        unset($data['action_reason']);

        if (!Schema::hasColumn('pets', 'is_active')) {
            unset($data['is_active']);
        }
        if (!Schema::hasColumn('pets', 'deactivation_reason')) {
            unset($data['deactivation_reason']);
        }

        $pet->update($data);

        return $this->success(
            $pet->load(['owner', 'speciesType', 'breed']),
            'Pet updated successfully.'
        );
    }

    /**
     * Delete a pet.
     * Admin only.
     * DELETE /pets/{pet}
     */
    public function destroy(Request $request, Pet $pet)
    {
        $this->authorize('delete', $pet);

        $reason = trim((string) $request->input('action_reason', ''));
        if ($reason === '') {
            return $this->error('Reason is required before deleting a pet.', 422);
        }

        if (Schema::hasColumn('pets', 'deletion_reason')) {
            $pet->deletion_reason = $reason;
            $pet->save();
        }

        $this->deletePhotoFromStorage($pet->photo_url);

        $pet->delete();

        return $this->success(null, 'Pet deleted successfully.');
    }

    private function storageDisk(): string
    {
        if (!config('filesystems.disks.supabase.key')) {
            return 'public';
        }

        // If Supabase/S3 driver dependencies are missing in this environment,
        // gracefully fall back to local public storage.
        try {
            Storage::disk('supabase');
            return 'supabase';
        } catch (\Throwable) {
            return 'public';
        }
    }

    private function storageUrl(string $disk, string $path, ?Request $request = null): string
    {
        if ($disk === 'public') {
            $relative = Storage::disk('public')->url($path);
            if ($request) {
                return rtrim($request->getSchemeAndHttpHost(), '/') . $relative;
            }
            return $relative;
        }
        // Build the correct Supabase public CDN URL
        $base = rtrim((string) config('filesystems.disks.supabase.public_url'), '/');
        if ($base === '') {
            $endpoint = (string) config('filesystems.disks.supabase.endpoint', '');
            $base = preg_replace('#/storage/v1/s3/?$#', '', rtrim($endpoint, '/'));
        }
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare');
        return "{$base}/storage/v1/object/public/{$bucket}/{$path}";
    }

    private function deletePhotoFromStorage(?string $photoUrl): void
    {
        if (!$photoUrl) return;
        $disk   = $this->storageDisk();
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare');
        $marker = $disk === 'supabase'
            ? "/storage/v1/object/public/{$bucket}/"
            : '/storage/';
        $pos = strpos($photoUrl, $marker);
        if ($pos === false) return;
        $path = strtok(substr($photoUrl, $pos + strlen($marker)), '?');
        try {
            Storage::disk($disk)->delete($path);
        } catch (\Throwable) {
            // Non-fatal
        }
    }

    /**
     * Upload a pet profile photo.
     * POST /pets/{pet}/photo  (admin/staff)
     * POST /my-pets/{pet}/photo  (customer — own pet only)
     */
    public function uploadPhoto(Request $request, Pet $pet)
    {
        // Allow admin, staff, or the pet's own owner
        $user = $request->user();
        if (!$user->isAdmin() && !$user->isStaff()) {
            $ownerId = $this->resolveOwnerIdForUser($user);
            if ($pet->owner_id !== $ownerId) {
                return $this->error('Unauthorized.', 403);
            }
        }

        // Accept both `photo` and `image` keys for cross-client compatibility.
        $fileField = $request->hasFile('photo') ? 'photo' : ($request->hasFile('image') ? 'image' : null);
        if (!$fileField) {
            return $this->error('A photo file is required. Use multipart/form-data with key `photo` (or `image`).', 422);
        }

        $request->validate([
            $fileField => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ], [
            "{$fileField}.required" => 'A photo file is required.',
            "{$fileField}.image"    => 'The file must be an image (jpg, jpeg, png, or webp).',
            "{$fileField}.mimes"    => 'Allowed image types: jpg, jpeg, png, webp.',
            "{$fileField}.max"      => 'Photo must not exceed 5 MB.',
        ]);

        $extension = $request->file($fileField)->getClientOriginalExtension();
        $oldUrl = $pet->photo_url;
        $path   = 'pets/photos/' . $pet->id . '-' . now()->format('YmdHisv') . '.' . $extension;
        $disk = $this->storageDisk();

        $stored = Storage::disk($disk)->put(
            $path,
            file_get_contents($request->file($fileField)->getRealPath()),
            'public'
        );

        if (!$stored) {
            return $this->error('The profile photo could not be stored. Please try again.', 500);
        }

        $url = $this->storageUrl($disk, $path, $request);

        $pet->update(['photo_url' => $url]);

        // Delete old photo after new one is saved successfully
        if ($oldUrl && $oldUrl !== $url) {
            $this->deletePhotoFromStorage($oldUrl);
        }

        return $this->success(['photo_url' => $url], 'Photo uploaded successfully.');
    }

    /**
    * Upload a nose print image, generate SHA-256 hash, and store both.
     * Task #62 / #67 — POST /pets/{pet}/nose-print
     */
    public function uploadNosePrint(Request $request, Pet $pet)
    {
        $this->authorize('update', $pet);

        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ], [
            'image.required' => 'A nose print image file is required.',
            'image.image'    => 'The file must be an image.',
            'image.max'      => 'Image must not exceed 5 MB.',
        ]);

        $file = $request->file('image');
        $hash = hash('sha256', file_get_contents($file->getRealPath()));

        // Reject if another pet already owns this exact nose print hash
        $conflict = Pet::where('nose_print_hash', $hash)
            ->where('id', '!=', $pet->id)
            ->first();

        if ($conflict) {
            return $this->error('This nose print is already registered to another pet.', 422);
        }

        $extension  = $file->getClientOriginalExtension();
        $path = 'pets/nose-prints/' . $pet->id . '.' . $extension;
        $disk = $this->storageDisk();

        Storage::disk($disk)->put(
            $path,
            file_get_contents($file->getRealPath()),
            'public'
        );

        $url = $this->storageUrl($disk, $path, $request);

        $pet->update([
            'nose_print_image_url' => $url,
            'nose_print_hash'      => $hash,
        ]);

        return $this->success([
            'nose_print_image_url' => $url,
            'nose_print_hash'      => $hash,
        ], 'Nose print uploaded successfully.');
    }

    /**
     * Mark a pet as enrolled for recognition and optionally persist identification hash metadata.
     * POST /pets/{pet}/recognition-enroll
     */
    public function markRecognitionEnrolled(Request $request, Pet $pet)
    {
        $this->authorize('update', $pet);

        $validated = $request->validate([
            'identification_hash' => 'nullable|string|max:255',
            'identification_image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            'recognition_registered' => 'nullable|boolean',
            'recognition_registered_at' => 'nullable|date',
        ]);

        $identificationImageUrl = $pet->identification_image_url;
        $recognitionImageContents = null;
        $recognitionImageHash = null;
        if ($request->hasFile('identification_image')) {
            $file = $request->file('identification_image');
            $extension = $file->getClientOriginalExtension();
            $recognitionImageContents = file_get_contents($file->getRealPath());
            $recognitionImageHash = hash('sha256', $recognitionImageContents);
            $path = 'pets/identification/' . $pet->id . '-' . now()->format('YmdHisv') . '.' . $extension;
            $disk = $this->storageDisk();

            Storage::disk($disk)->put(
                $path,
                $recognitionImageContents,
                'public'
            );

            $identificationImageUrl = $this->storageUrl($disk, $path, $request);
        }

        $pet->update([
            'identification_hash' => $validated['identification_hash'] ?? $pet->identification_hash,
            'identification_image_url' => $identificationImageUrl,
            'recognition_registered' => $validated['recognition_registered'] ?? true,
            'recognition_registered_at' => $validated['recognition_registered_at'] ?? now(),
        ]);

        // Keep the recognition gallery in sync with the enrollment image. The
        // frontend also calls /recognition-photo after enrollment, but saving
        // here makes the backend flow reliable even when that follow-up request
        // is interrupted or a stale frontend bundle is still deployed.
        if ($recognitionImageContents !== null && $recognitionImageHash !== null) {
            $existingPhoto = $pet->recognitionPhotos()->where('image_hash', $recognitionImageHash)->first();
            if (!$existingPhoto) {
                $extension = strtolower($request->file('identification_image')->getClientOriginalExtension() ?: 'jpg');
                $recognitionPath = 'pets/recognition/' . $pet->id . '-' . $recognitionImageHash . '.' . $extension;
                $disk = $this->storageDisk();
                Storage::disk($disk)->put($recognitionPath, $recognitionImageContents, 'public');
                $pet->recognitionPhotos()->create([
                    'photo_url' => $this->storageUrl($disk, $recognitionPath, $request),
                    'image_hash' => $recognitionImageHash,
                    'captured_at' => now('Asia/Manila'),
                ]);
            }
        }

        // Notify the pet owner about successful recognition enrollment
        if ($pet->owner_id) {
            try {
                $species = strtolower($pet->speciesType?->name ?? '');
                $method = str_contains($species, 'cat') ? 'Facial Recognition' : 'Nose Print Identification';
                Notification::create([
                    'owner_id'  => $pet->owner_id,
                    'subject'   => 'Pet Identification Enrolled',
                    'message'   => 'Your pet ' . $pet->name . ' has been successfully enrolled in our ' . $method . ' system. Their identity is now secured for future visits.',
                    'type'      => 'pet_recognition',
                    'channel'   => 'in_app',
                    'status'    => 'sent',
                    'is_read'   => false,
                    'sent_at'   => now('Asia/Manila'),
                ]);
            } catch (\Exception $e) {
                \Log::warning('Pet recognition notification failed: ' . $e->getMessage());
            }
        }

        return $this->success([
            'pet_id' => $pet->pet_id,
            'identification_hash' => $pet->identification_hash,
            'identification_image_url' => $pet->identification_image_url,
            'recognition_registered' => (bool) $pet->recognition_registered,
            'recognition_registered_at' => $pet->recognition_registered_at,
        ], 'Pet recognition enrollment synced.');
    }

    public function storeRecognitionPhoto(Request $request, Pet $pet)
    {
        $this->authorize('update', $pet);
        $request->validate(['image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120']);

        $file = $request->file('image');
        $contents = file_get_contents($file->getRealPath());
        $hash = hash('sha256', $contents);
        $existing = $pet->recognitionPhotos()->where('image_hash', $hash)->first();
        if ($existing) {
            return $this->success(['id' => $existing->id, 'photo_url' => $existing->photo_url, 'captured_at' => $existing->captured_at], 'Recognition photo already saved.');
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $path = 'pets/recognition/' . $pet->id . '-' . $hash . '.' . $extension;
        $disk = $this->storageDisk();
        Storage::disk($disk)->put($path, $contents, 'public');
        $url = $this->storageUrl($disk, $path, $request);

        $photo = $pet->recognitionPhotos()->create([
            'photo_url' => $url,
            'image_hash' => $hash,
            'captured_at' => now('Asia/Manila'),
        ]);

        return $this->success(['id' => $photo->id, 'photo_url' => $photo->photo_url, 'captured_at' => $photo->captured_at], 'Recognition photo saved.');
    }

    /**
    * Identify a pet by submitting a pet identification image.
    * Hashes the uploaded image and matches against stored identification_hash.
     * Task #66 — POST /pets/nose-print-lookup
     */
    public function nosePrintLookup(Request $request)
    {
        $this->authorize('viewAny', Pet::class);

        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ], [
            'image.required' => 'A nose print image is required.',
            'image.max'      => 'Image must not exceed 5 MB.',
        ]);

        $hash = hash('sha256', file_get_contents($request->file('image')->getRealPath()));

        $pet = Pet::with(['owner', 'speciesType', 'breed'])
            ->where('nose_print_hash', $hash)
            ->first();

        if (!$pet) {
            return $this->error('No pet found matching this nose print.', 404);
        }

        return $this->success($pet, 'Pet identified successfully.');
    }

    private function resolveOwnerForUser(User $user): ?Owner
    {
        if ($user->owner) {
            return $user->owner;
        }

        $owner = Owner::where('email', $user->email)->first();
        if ($owner && !$owner->user_id) {
            $owner->update(['user_id' => $user->id]);
        }

        return $owner;
    }

    private function resolveOwnerIdForUser(User $user): ?string
    {
        return $this->resolveOwnerForUser($user)?->id;
    }
}
