<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Models\HotelSuite;
use App\Services\HotelClusterAllocator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BookingFlowController extends Controller
{
    public function __construct(private readonly HotelClusterAllocator $hotelAllocator)
    {
    }

    private function denyGroomerBooking(Request $request): void
    {
        abort_if($request->user()?->isGroomer(), 403, 'Groomers cannot manage customer bookings.');
    }

    /**
     * Get all service categories
     * GET /api/booking/categories
     */
    public function getCategories()
    {
        $categories = Cache::remember('booking:categories:v1', 300, function () {
            return DB::table('service_categories')
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'color']);
        });

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get all owners for booking
     * GET /api/booking/owners
     */
    public function getOwners(Request $request)
    {
        $this->denyGroomerBooking($request);
        $query = Owner::query()
            ->select([
                'id',
                'display_id',
                'first_name',
                'last_name',
                'email',
                'phone',
                'address',
                'address_street',
                'address_barangay',
                'address_city',
                'address_province',
            ])
            ->with([
                'pets' => fn($q) => $q->select('id', 'owner_id', 'pet_id', 'name', 'species_id', 'breed_id', 'sex', 'date_of_birth', 'photo_url', 'weight_kg', 'medical_notes'),
                'pets.speciesType' => fn($q) => $q->select('id', 'name', 'code'),
                'pets.breed' => fn($q) => $q->select('id', 'name', 'species_id'),
            ]);

        // Search filter: support first name, last name, full name, email, display ID, and phone.
        $search = trim((string) ($request->query('search', $request->query('q', ''))));
        if ($search !== '') {
            $normalizedSearch = preg_replace('/\s+/', ' ', mb_strtolower($search));
            $words = array_values(array_filter(explode(' ', $normalizedSearch)));
            $needle = '%' . $normalizedSearch . '%';
            $phoneDigits = preg_replace('/\D+/', '', $search);

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

        $perPage = min((int) $request->query('per_page', 20), 50);
        $cacheKey = 'booking:owners:v3:' . md5(json_encode([
            'search' => $search,
            'page' => (int) $request->query('page', 1),
            'per_page' => $perPage,
        ]));

        $owners = Cache::remember($cacheKey, 60, function () use ($query, $perPage) {
            return $query
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->paginate($perPage);
        });

        return response()->json([
            'success' => true,
            'data' => $owners,
        ]);
    }

    /**
     * Get pets by owner
     * GET /api/booking/owners/{ownerId}/pets
     */
    public function getPetsByOwner($ownerId)
    {
        $this->denyGroomerBooking(request());
        $pets = Cache::remember('booking:pets:v1:' . (string) $ownerId, 300, function () use ($ownerId) {
            return Pet::select([
                    'id',
                    'owner_id',
                    'pet_id',
                    'name',
                    'species_id',
                    'breed_id',
                    'sex',
                    'date_of_birth',
                    'photo_url',
                    'weight_kg',
                    'medical_notes',
                ])
                ->with([
                    'speciesType:id,name,code',
                    'breed:id,name,species_id',
                ])
                ->where('owner_id', $ownerId)
                ->orderBy('name')
                ->get();
        });

        return response()->json([
            'success' => true,
            'data' => $pets,
        ]);
    }

    /**
     * Get services by category with tiers
     * GET /api/booking/services?category={category}
     */
    public function getServicesByCategory(Request $request)
    {
        $category = $request->query('category');
        $cacheKey = 'booking:services:v3:' . ($category ?: 'all');
        $services = Cache::remember($cacheKey, 300, function () use ($category) {
            $query = Service::select(['id', 'name', 'category', 'description', 'needs_cage'])
                ->with(['serviceTiers:id,service_id,size_label,price,duration_hours'])
                ->with(['serviceTiers.promotions' => fn($q) => $q->where('is_active', true)])
                ->where('is_active', true);

            if ($category) {
                $query->where('category', $category);
            }

            return $query->orderBy('name')->get();
        });

        return response()->json([
            'success' => true,
            'data' => $services->map(function($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'category' => $service->category,
                    'description' => $service->description,
                    'needs_cage' => $service->needs_cage,
                    'promotions' => $service->serviceTiers->flatMap->promotions->unique('id')->map(fn($promo) => [
                        'id' => $promo->id, 'title' => $promo->title,
                        'description' => $promo->description,
                        'discount_type' => $promo->discount_type,
                        'discount_value' => $promo->discount_value,
                        'promotional_price' => $promo->promotional_price,
                        'starts_on' => $promo->starts_on?->toDateString(),
                        'ends_on' => $promo->ends_on?->toDateString(),
                    ]),
                    'tiers' => $service->serviceTiers->map(function($tier) {
                        return [
                            'id' => $tier->id,
                            'size_label' => $tier->size_label,
                            'price' => $tier->price,
                            'duration_hours' => $tier->duration_hours,
                            'promotions' => $tier->promotions->map(fn($promo) => [
                                'id' => $promo->id, 'title' => $promo->title,
                                'discount_type' => $promo->discount_type, 'discount_value' => $promo->discount_value,
                                'promotional_price' => $promo->promotional_price,
                                'starts_on' => $promo->starts_on?->toDateString(), 'ends_on' => $promo->ends_on?->toDateString(),
                            ]),
                        ];
                    }),
                ];
            }),
        ]);
    }

    /**
     * Get addons by category
     * GET /api/booking/addons?category={category}
     */
    public function getAddonsByCategory(Request $request)
    {
        $serviceCategory = strtolower(trim((string) $request->query('category')));
        if ($serviceCategory !== 'grooming') {
            return response()->json([
                'success' => true,
                'data' => [],
                'count' => 0,
            ]);
        }
        $cacheKey = 'booking:addons:v6:grooming';
        $addons = Cache::remember($cacheKey, 300, function () {
            return ServiceAddon::select([
                    'id',
                    'name',
                    'category',
                    'addon_group',
                    'tier_label',
                    'price_min',
                    'price_max',
                    'has_size_pricing',
                    'applies_to_grooming',
                    'applies_to_daycare',
                    'applies_to_hotel',
                    'is_active',
                    'display_id',
                ])
                ->where(function ($query) {
                    $query->where('applies_to_grooming', true)
                        ->orWhereIn('category', ['grooming_extra', 'grooming_addon']);
                })
                ->where('is_active', true)
                ->orderBy('name')
                ->get();
        });

        $pawsomeExtrasOrder = [
            'Tooth Brush',
            'Nail Trim',
            'Ear Cleaning',
            'Face Trim',
            'Poodle Feet',
            'Anal Sac',
            'Paw Shave',
            'Sanitary Shave',
            'Round Face',
            'Dematting - S',
            'Dematting - M',
            'Dematting - L',
            'Dematting - XL',
            'Medicated Bath - S',
            'Medicated Bath - M',
            'Medicated Bath - L',
            'Organic Bath - S',
            'Organic Bath - M',
            'Whitening - S',
            'Whitening - M',
        ];

        if ($serviceCategory === 'grooming') {
            $addons = $addons
                ->sortBy(fn ($addon) => array_search($addon->name, $pawsomeExtrasOrder, true) === false
                    ? 999
                    : array_search($addon->name, $pawsomeExtrasOrder, true))
                ->values();
        }

        return response()->json([
            'success' => true,
            'data' => $addons,
            'count' => $addons->count(),
        ]);
    }

    /**
     * Get available hotel suites filtered by pet
     * GET /api/booking/hotel-suites?species={species}&date={date}&nights={nights}
     */
    public function getAvailableHotelSuites(Request $request)
    {
        $request->validate([
            'date' => 'nullable|date|after_or_equal:today',
            'nights' => 'nullable|integer|min:1|max:30',
            'pet_id' => 'nullable|uuid|exists:pets,id',
            'owner_id' => 'nullable|uuid|exists:owners,id',
            'species' => 'nullable|string|max:20',
            'dog_size' => 'nullable|string|max:30',
            'pet_size' => 'nullable|string|max:20',
            'size_label' => 'nullable|string|max:50',
        ]);

        $checkIn = $request->query('date', now('Asia/Manila')->toDateString());
        $nights = max(1, (int) $request->query('nights', 1));

        $pet = null;
        if ($request->filled('pet_id')) {
            $pet = Pet::with(['speciesType', 'owner'])->find($request->pet_id);
        }

        $species = $this->hotelAllocator->normalizeSpecies(
            $request->query('species')
            ?? $pet?->speciesType?->name
            ?? $pet?->speciesType?->code
        );

        $ownerId = $request->query('owner_id') ?? $pet?->owner_id;

        if (!$species) {
            return $this->error('Pet species is required for shared hotel inventory checks.', 422);
        }

        $dogSizeInput = $request->query('pet_size') ?? $request->query('dog_size');
        $dogSize = $species === 'dog'
            ? $this->hotelAllocator->normalizeDogSize($dogSizeInput)
            : null;

        $options = $this->hotelAllocator->optionsWithInventory($species, $dogSize, $checkIn, $nights, $ownerId);

        return $this->success([
            'species' => $species,
            'dog_size' => $dogSize,
            'check_in' => $checkIn,
            'nights' => $nights,
            'options' => $options,
        ], 'Cluster-based hotel options retrieved successfully.');
    }

    /**
     * Check hotel capacity for date range
     * GET /api/booking/hotel-capacity?check_in={date}&nights={nights}
     */
    public function checkHotelCapacity(Request $request)
    {
        $request->validate([
            'check_in' => 'required|date|after_or_equal:today',
            'nights' => 'nullable|integer|min:1|max:30',
            'pet_id' => 'nullable|uuid|exists:pets,id',
            'owner_id' => 'nullable|uuid|exists:owners,id',
            'species' => 'nullable|string|max:20',
            'dog_size' => 'nullable|string|max:30',
            'pet_size' => 'nullable|string|max:20',
            'size_label' => 'nullable|string|max:50',
        ]);

        $checkIn = $request->query('check_in');
        $nights = max(1, (int) $request->query('nights', 1));

        $pet = null;
        if ($request->filled('pet_id')) {
            $pet = Pet::with(['speciesType', 'owner'])->find($request->pet_id);
        }

        $species = $this->hotelAllocator->normalizeSpecies(
            $request->query('species')
            ?? $pet?->speciesType?->name
            ?? $pet?->speciesType?->code
        );

        $ownerId = $request->query('owner_id') ?? $pet?->owner_id;

        $clusters = ['A', 'B', 'C', 'D'];
        $clusterInventory = [];
        foreach ($clusters as $cluster) {
            $clusterInventory[] = $this->hotelAllocator->clusterInventory($cluster, $checkIn, $nights, $ownerId);
        }

        if (!$species) {
            return $this->error('Pet species is required for shared hotel inventory checks.', 422);
        }

        $dogSizeInput = $request->query('pet_size') ?? $request->query('dog_size');
        $dogSize = $species === 'dog'
            ? $this->hotelAllocator->normalizeDogSize($dogSizeInput)
            : null;
        $eligibleOptions = $this->hotelAllocator->optionsWithInventory($species, $dogSize, $checkIn, $nights, $ownerId);

        return $this->success([
            'is_available' => collect($eligibleOptions)->contains(fn($opt) => ($opt['available'] ?? 0) > 0),
            'check_in' => $checkIn,
            'nights' => $nights,
            'species' => $species,
            'dog_size' => $dogSize,
            'cluster_inventory' => $clusterInventory,
            'clusters' => $clusterInventory,
            'eligible_options' => $eligibleOptions,
        ], 'Hotel capacity checked successfully.');
    }

    /**
     * Validate booking before submission
     * POST /api/booking/validate
     */
    public function validateBooking(Request $request)
    {
        $this->denyGroomerBooking($request);
        $errors = [];

        // Validate owner
        if (!$request->filled('owner_id')) {
            $errors['owner_id'] = 'Owner is required';
        }

        // Validate pet
        if (!$request->filled('pet_id')) {
            $errors['pet_id'] = 'Pet is required';
        }

        // Validate services (at least 1, max 3)
        $services = $request->input('services', []);
        if (empty($services)) {
            $errors['services'] = 'At least one service is required';
        } elseif (count($services) > 3) {
            $errors['services'] = 'Maximum 3 services allowed';
        }

        // Validate each service
        foreach ($services as $index => $service) {
            if (!isset($service['service_id'])) {
                $errors["services.{$index}.service_id"] = 'Service is required';
            }
            if (!isset($service['tier_id'])) {
                $errors["services.{$index}.tier_id"] = 'Tier is required';
            }
            if (!isset($service['date'])) {
                $errors["services.{$index}.date"] = 'Date is required';
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'errors' => $errors,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking is valid',
        ]);
    }

    /**
     * Calculate total price for booking
     * POST /api/booking/calculate-price
     */
    public function calculatePrice(Request $request)
    {
        $this->denyGroomerBooking($request);
        $total = 0;
        $breakdown = [];

        $services = $request->input('services', []);

        foreach ($services as $service) {
            $serviceTotal = 0;
            $svc = null;
            $serviceBreakdown = [
                'service_name' => '',
                'tier_price' => 0,
                'addons' => [],
                'hotel_suite' => null,
                'subtotal' => 0,
            ];

            // Get tier price (non-hotel services)
            $isHotelTier = false;
            if (isset($service['tier_id'])) {
                $tier = DB::table('service_tiers')->find($service['tier_id']);
                if ($tier) {
                    $svc = DB::table('services')->find($tier->service_id);
                    $serviceBreakdown['service_name'] = $svc->name ?? 'Unknown';

                    $isHotelTier = ($svc->category ?? null) === 'hotel';

                    if (!$isHotelTier) {
                        $serviceTotal += floatval($tier->price);
                        $serviceBreakdown['tier_price'] = floatval($tier->price);
                    }
                }
            }

            // Add addons
            if (isset($service['addon_ids']) && is_array($service['addon_ids'])) {
                foreach ($service['addon_ids'] as $addonId) {
                    $addon = DB::table('service_addons')->find($addonId);
                    if ($addon) {
                        $addonPrice = floatval($addon->price_min);
                        $serviceTotal += $addonPrice;
                        $serviceBreakdown['addons'][] = [
                            'name' => $addon->name,
                            'price' => $addonPrice,
                        ];
                    }
                }
            }

            // Add hotel suite
            if (isset($service['hotel_suite_id']) && isset($service['nights'])) {
                $suite = DB::table('hotel_suites')->find($service['hotel_suite_id']);
                if ($suite) {
                    $pet = null;
                    $petId = $service['pet_id'] ?? $request->input('pet_id');
                    if ($petId) {
                        $pet = Pet::with('speciesType')->find($petId);
                    }

                    $species = $this->hotelAllocator->normalizeSpecies(
                        $service['species']
                        ?? $request->input('species')
                        ?? $pet?->speciesType?->name
                        ?? $pet?->speciesType?->code
                    );

                    $dogSize = $species === 'dog'
                        ? $this->hotelAllocator->normalizeDogSize(
                            $service['pet_size']
                            ?? $request->input('pet_size')
                            ?? $service['dog_size']
                            ?? $request->input('dog_size')
                        )
                        : null;

                    $selected = $this->hotelAllocator->validateSuiteSelection($species ?? '', $dogSize, $suite->name);

                    if (!$selected) {
                        $serviceBreakdown['hotel_suite'] = [
                            'name' => $suite->name,
                            'error' => 'Selected suite is not allowed for species/size mapping.',
                        ];
                        $serviceBreakdown['subtotal'] = $serviceTotal;
                        $breakdown[] = $serviceBreakdown;
                        $total += $serviceTotal;
                        continue;
                    }

                    $nightlyRate = $selected['nightly_rate'];
                    $suiteTotal = floatval($nightlyRate) * intval($service['nights']);
                    $serviceTotal += $suiteTotal;
                    $serviceBreakdown['hotel_suite'] = [
                        'name' => $suite->name,
                        'cluster' => $selected['cluster'],
                        'pricing_state' => $selected['pricing_state'],
                        'price_per_night' => floatval($nightlyRate),
                        'nights' => intval($service['nights']),
                        'total' => $suiteTotal,
                    ];
                }
            }

            $promo = null;
            $promoDate = $request->input('appointment_date', now()->toDateString());
            if (!empty($service['promotion_id']) && isset($service['tier_id'])) {
                $promo = \App\Models\Promotion::query()->availableOn($promoDate)
                    ->whereKey($service['promotion_id'])
                    ->whereHas('serviceTiers', fn($q) => $q->whereKey($service['tier_id']))
                    ->first();
                if (!$promo) {
                    return response()->json([
                        'success' => false,
                        'message' => 'The selected promotion is inactive, expired, or not eligible for this service package.',
                        'errors' => ['services' => ['Invalid promotion selection.']],
                    ], 422);
                }
            }
            if ($promo) {
                $original = $serviceTotal;
                $serviceTotal = $promo->priceFor($serviceTotal);
                $serviceBreakdown['promotion'] = [
                    'id' => $promo->id, 'title' => $promo->title,
                    'original_price' => $original, 'discounted_price' => $serviceTotal,
                    'savings' => $original - $serviceTotal,
                ];
            }
            $serviceBreakdown['subtotal'] = $serviceTotal;
            $breakdown[] = $serviceBreakdown;
            $total += $serviceTotal;
        }

        return $this->success([
            'total' => $total,
            'breakdown' => $breakdown,
        ], 'Booking price calculated successfully.');
    }
}
