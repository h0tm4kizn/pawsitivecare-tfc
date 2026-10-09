<?php

namespace App\Services;

use App\Http\Requests\StoreAppointmentRequest;
use App\Http\Requests\UpdateAppointmentRequest;
use App\Http\Requests\UpdateAppointmentStatusRequest;
use App\Models\Appointment;
use App\Models\AppointmentBookedPackage;
use App\Models\AuditLog;
use App\Models\PetHealthForm;
use App\Models\Pet;
use App\Models\Service;
use App\Models\User;
use App\Models\ServiceAddon;
use App\Models\ServiceTier;
use App\Models\HotelSuite;
use App\Models\HotelExtensionCharge;
use App\Models\ShopHoursSetting;
use App\Services\HotelClusterAllocator;
use App\Services\HotelExtensionService;
use App\Services\AppointmentPricingService;
use App\Services\AppointmentNotificationService;
use App\Services\AppointmentAvailabilityService;
use App\Services\StaffCommissionService;
use App\Services\StaffAttendanceService;
use App\Support\CustomerAppointmentFormatter;
use App\Mail\BookingConfirmationMail;
use App\Mail\ThankYouMail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\AppointmentNoShowMail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class AppointmentBookingService
{
    private ?bool $hasBookedPackagesTable = null;
    private ?array $appointmentsTableColumns = null;

    public function __construct(
        protected readonly HotelClusterAllocator $hotelAllocator,
        protected readonly HotelExtensionService $hotelExtensionService,
        protected readonly AppointmentPricingService $pricingService,
        protected readonly AppointmentNotificationService $notificationService,
        protected readonly AppointmentAvailabilityService $availabilityService,
        protected readonly StaffCommissionService $commissionService,
        protected readonly StaffAttendanceService $attendanceService,
    ) {}

    public function store(StoreAppointmentRequest $request)
{
    $this->authorize('create', Appointment::class);

    return DB::transaction(function () use ($request) {
        // 1. Validate first
        $validated = $request->validated();

        if (($validated['booking_source'] ?? null) === 'walk_in'
            && $validated['appointment_date'] !== \Illuminate\Support\Carbon::now('Asia/Manila')->toDateString()) {
            return $this->error('Walk-in appointments are only available for today.', 422);
        }

        $handledById = $validated['handled_by'] ?? Auth::id();
        $handler = $handledById ? User::query()->find($handledById) : null;
        if (!$handler || (!$handler->isAdmin() && !$handler->isStaff())) {
            return $this->error('Please select a valid admin, staff member, or groomer who handled the booking.', 422);
        }

        $bookedByOwnerId = $validated['booked_by_owner_id'] ?? Auth::user()?->owner?->id;

        if (!$bookedByOwnerId) {
            return $this->error('booked_by_owner_id is required when creating appointments from admin/staff.', 422);
        }

        $pet = \App\Models\Pet::find($validated['pet_id']);
        if (!$pet || $pet->owner_id !== $bookedByOwnerId) {
            return $this->error('Selected pet does not belong to the selected owner.', 422);
        }

        // Enforce pet-level assessment form completion before booking.

        $hasAssessment = PetHealthForm::query()
            ->where('pet_id', $validated['pet_id'])
            ->where('owner_id', $bookedByOwnerId)
            ->where('declaration_accepted', true)
            ->exists();

        if (!$hasAssessment) {
            return $this->error('Please complete the Pet Assessment Form for this pet before booking.', 422);
        }

        // 2. Double-booking check BEFORE creating
        // 3. Lookup service tier price (skip for hotel - priced by suite/night)
        $bookedItems = $this->normalizeBookedPackagesInput($validated);
        $isWalkInRequest = ($validated['booking_source'] ?? null) === 'walk_in';
        foreach ($bookedItems as $bookedItem) {
            $itemDate = (string) ($bookedItem['appointment_date'] ?? $validated['appointment_date'] ?? '');
            $itemTime = $bookedItem['start_time'] ?? $validated['start_time'] ?? null;
            if (($validated['booking_source'] ?? null) === 'walk_in'
                && $itemDate !== \Illuminate\Support\Carbon::now('Asia/Manila')->toDateString()) {
                return $this->error('Walk-in appointments are only available for today.', 422);
            }
            if (!$isWalkInRequest && $this->appointmentTimeHasPassed($itemDate, $itemTime)) {
                return $this->error('You cannot book an appointment for a time that has already passed.', 422);
            }
        }
        $serviceIds = collect($bookedItems)->pluck('service_id')->filter()->unique()->values();
        $services = Service::query()->whereIn('id', $serviceIds)->get()->keyBy('id');
        if ($services->count() !== $serviceIds->count()) {
            return $this->error('One or more selected packages are invalid.', 422);
        }

        $compatibilityError = $this->assertBookingCompatibility($services->values()->all());
        if ($compatibilityError) {
            return $this->error($compatibilityError, 422);
        }

        $orderedServices = $this->orderBookedServices($services->values()->all());
        $primaryService = $orderedServices[0] ?? null;
        $isHotel = strtolower((string) ($primaryService?->category ?? '')) === 'hotel';
        $isDaycare = strtolower((string) ($primaryService?->category ?? '')) === 'daycare';
        $isGrooming = strtolower((string) ($primaryService?->category ?? '')) === 'grooming';
        $isGroomingOnly = $isGrooming && $services->every(fn (Service $service) => strtolower((string) $service->category) === 'grooming');
        $walkInStartedImmediately = false;
        if ($isWalkInRequest && $isGroomingOnly) {
            $requestedStart = (string) ($bookedItems[0]['start_time'] ?? $validated['start_time'] ?? '');
            if ($this->availabilityService->isImmediateGroomingWalkIn((string) $validated['appointment_date'], $requestedStart)) {
                $walkInStartedImmediately = true;
                $actualStart = now('Asia/Manila')->startOfMinute()->format('H:i:s');
                $validated['start_time'] = $actualStart;
                foreach ($bookedItems as &$bookedItem) {
                    if (isset($services[$bookedItem['service_id']])
                        && strtolower((string) $services[$bookedItem['service_id']]->category) === 'grooming') {
                        $bookedItem['start_time'] = $actualStart;
                    }
                }
                unset($bookedItem);
            }
        }
        if ($isWalkInRequest && !$walkInStartedImmediately) {
            foreach ($bookedItems as $bookedItem) {
                $itemDate = (string) ($bookedItem['appointment_date'] ?? $validated['appointment_date'] ?? '');
                $itemTime = $bookedItem['start_time'] ?? $validated['start_time'] ?? null;
                if ($this->appointmentTimeHasPassed($itemDate, $itemTime)) {
                    if ($this->availabilityService->isImmediateGroomingWalkIn($itemDate, $itemTime)) {
                        continue;
                    }
                    return $this->error('You cannot book an appointment for a time that has already passed.', 422);
                }
            }
        }

        if ($isGrooming && !empty($validated['handled_by'])) {
            if ($error = $this->groomerAssignmentError($handler)) {
                return $this->error($error, 422);
            }
        } elseif ($isGrooming && !array_key_exists('handled_by', $validated)) {
            // Booking staff is not the Groomer who performs the service.
            $handledById = null;
        }
        if ($walkInStartedImmediately) {
            $this->availabilityService->lockGroomingCapacityForUpdate();
            foreach ($orderedServices as $service) {
                $item = collect($bookedItems)->firstWhere('service_id', $service->id) ?? [];
                if ($this->availabilityService->hasSlotConflict(
                    $item['appointment_date'] ?? $validated['appointment_date'],
                    $item['start_time'] ?? $validated['start_time'],
                    (string) $service->id,
                    $item['size_label'] ?? $validated['size_label'] ?? null
                )) {
                    return $this->error('This time slot is already full. Please select another date or time.', 409);
                }
            }
        }
        $hotelPetSize = null;
        if ($isHotel) {
            $hotelItem = collect($bookedItems)->firstWhere('service_id', $primaryService->id) ?? [];
            $pet->loadMissing('speciesType');
            $species = $this->hotelAllocator->normalizeSpecies(
                $pet->speciesType?->name ?? $pet->speciesType?->code
            );
            $hotelPetSize = $this->hotelAllocator->normalizeConfirmedPetSize(
                $hotelItem['pet_size'] ?? $validated['pet_size'] ?? null,
                $species
            );
            if (!$hotelPetSize) {
                return $this->error('Select a valid Pet Size for the selected pet before booking the hotel suite.', 422);
            }
        }
        $additionalPetIds = collect($validated['additional_pet_ids'] ?? [])->filter()->unique()->values();
        $daycarePetSizeMap = collect($validated['daycare_pet_sizes'] ?? [])
            ->filter(fn($row) => !empty($row['pet_id']) && !empty($row['size_label']))
            ->mapWithKeys(fn($row) => [(string) $row['pet_id'] => (string) $row['size_label']]);
        $extraPets = collect();
        if (!$primaryService) {
            return $this->error('At least one service package is required.', 422);
        }

        // Daycare-specific validations
        if ($isDaycare) {
            $extraPets = Pet::query()->whereIn('id', $additionalPetIds)->with('speciesType')->get();
            if ($extraPets->count() !== $additionalPetIds->count()
                || $extraPets->contains(fn($extraPet) => (string) $extraPet->owner_id !== (string) $bookedByOwnerId)) {
                return $this->error('All daycare pets must belong to the selected owner.', 422);
            }
            if (1 + $extraPets->count() > 3) {
                return $this->error('A maximum of three pets may be booked in one daycare slot.', 422);
            }
            if ($extraPets->contains(function ($extraPet) use ($bookedByOwnerId) {
                $species = strtolower((string) ($extraPet->speciesType?->name ?? ''));
                return str_contains($species, 'cat') || str_contains($species, 'feline')
                    || !PetHealthForm::query()->where('pet_id', $extraPet->id)->where('owner_id', $bookedByOwnerId)->where('declaration_accepted', true)->exists();
            })) {
                return $this->error('Every selected daycare pet must be an eligible dog with a completed assessment.', 422);
            }
            // 1. Species check: cats cannot book daycare
            $pet->loadMissing('speciesType');
            $speciesCode = strtoupper((string) ($pet->speciesType?->code ?? ''));
            $speciesName = strtolower((string) ($pet->speciesType?->name ?? ''));
            if ($speciesCode === 'C' || str_contains($speciesName, 'cat') || str_contains($speciesName, 'feline')) {
                return $this->error('Daycare services are available for dogs only. Cats cannot be booked due to safety concerns.', 422);
            }

            // 2. Duration tier required
            $daycareDuration = $validated['daycare_duration'] ?? null;
            if (!$daycareDuration || !in_array($daycareDuration, ['hourly', 'half_day', 'full_day'])) {
                return $this->error('Duration tier selection is required for daycare bookings. Please select Hourly, Half Day, or Full Day.', 422);
            }

            // 3. Time restriction check
            $tierCloseMap = [
                'hourly'   => '17:00:00',
                'half_day' => '16:00:00',
                'full_day' => '13:00:00',
            ];
            $latestStart = $tierCloseMap[$daycareDuration];
            $startTime = $this->normalizeClockTime((string) ($validated['start_time'] ?? ''));
            if ($startTime > $latestStart) {
                $tierLabels = ['hourly' => 'Hourly', 'half_day' => 'Half Day', 'full_day' => 'Full Day'];
                $cutoffLabel = date('g:i A', strtotime($latestStart));
                return $this->error("The selected start time is not available for {$tierLabels[$daycareDuration]} daycare. Latest start time is {$cutoffLabel}.", 422);
            }

            $daycareAvailabilityError = $this->availabilityService->daycareSlotAvailabilityError(
                $validated['appointment_date'],
                (string) ($validated['start_time'] ?? ''),
                $daycareDuration,
                (string) $bookedByOwnerId,
                1 + $extraPets->count()
            );
            if ($daycareAvailabilityError) {
                return $this->error($daycareAvailabilityError, 422);
            }
        }

        if ($isHotel) {
            if (empty($validated['hotel_suite_id']) || empty($validated['hotel_nights'])) {
                return $this->error('Hotel reservations require a suite and number of nights.', 422);
            }
            $reservationChannel = $validated['reservation_channel'] ?? null;
            if (!$reservationChannel) {
                return $this->error('Please select a payment method.', 422);
            }
            if ($reservationChannel !== 'cash' && (empty($validated['reservation_payment_account_id']) || empty($validated['reservation_payer_provider']) || (empty($validated['reference_number']) && empty($validated['has_deposit_proof'])))) {
                return $this->error('E-wallet and bank transfer payments require Payment To, Payment From, and either a reference number or proof of payment.', 422);
            }
            if ($reservationChannel !== 'cash' && !$this->configuredPaymentAccount($validated['reservation_payment_account_id'], null)) {
                return $this->error('The selected receiving payment account is unavailable.', 422);
            }
        }

        $scheduleError = $this->validateBookingWindow(
            $validated['appointment_date'],
            $validated['start_time'] ?? null,
            $primaryService->category ?? null,
            $validated['booking_source'] ?? null
        );
        if ($scheduleError) {
            return $scheduleError;
        }

        if (!$isHotel) {
            foreach ($orderedServices as $svc) {
                // Skip slot conflict for daycare; capacity is handled above.
                if (strtolower((string) ($svc->category ?? '')) === 'daycare') {
                    continue;
                }

                $item = collect($bookedItems)->firstWhere('service_id', $svc->id) ?? [];
                if (strtolower((string) ($svc->category ?? '')) === 'grooming') {
                    $this->availabilityService->lockGroomingCapacityForUpdate();
                }
                $exists = $this->availabilityService->hasSlotConflict(
                    $item['appointment_date'] ?? $validated['appointment_date'],
                    $item['start_time'] ?? $validated['start_time'],
                    $svc->id,
                    $item['size_label'] ?? $validated['size_label'] ?? null
                );

                if ($exists) {
                    return $this->error(
                        strtolower((string) ($svc->category ?? '')) === 'grooming'
                            ? 'This time slot is already full. Please select another date or time.'
                            : 'This time slot is already booked for the selected service.',
                        strtolower((string) ($svc->category ?? '')) === 'grooming' ? 409 : 422
                    );
                }
            }
        }

        // 3a. For hotel bookings, enforce cluster logic + overlapping checks
        $hotelSelection = null;
        if ($isHotel && !empty($validated['hotel_suite_id']) && !empty($validated['hotel_nights'])) {
            $checkIn  = $validated['appointment_date'];
            $nights   = (int) $validated['hotel_nights'];
            $suite    = \App\Models\HotelSuite::find($validated['hotel_suite_id']);

            if (!$suite) {
                return $this->error('Selected hotel suite was not found.', 422);
            }
            if (!$suite->is_available) {
                return $this->error('No Hotel Suite is available for the selected dates. Please choose another date or suite.', 409);
            }

            $species = $this->hotelAllocator->normalizeSpecies(
                $pet?->speciesType?->name ?? $pet?->speciesType?->code
            );
            $dogSize = $species === 'dog'
                ? $this->hotelAllocator->normalizeDogSize($hotelPetSize)
                : null;

            $hotelSelection = $this->hotelAllocator->validateSuiteSelection($species ?? '', $dogSize, $suite->name);
            if (!$hotelSelection) {
                return $this->error('Selected hotel suite does not match the allowed species/size decision tree.', 422);
                }

                $this->hotelAllocator->lockCapacityForUpdate();
                $petOverlap = $this->hasOverlappingHotelBooking(
                    (string) $validated['pet_id'],
                    $checkIn,
                    $nights
                );

            if ($petOverlap) {
                return $this->error('This pet already has a hotel booking that overlaps the selected dates.', 422);
            }

            $inventory = $this->hotelAllocator->clusterInventory(
                $hotelSelection['cluster'],
                $checkIn,
                $nights,
                $bookedByOwnerId
            );

            if (($inventory['available'] ?? 0) <= 0) {
                return $this->error('No Hotel Suite is available for the selected dates. Please choose another date or suite.', 409);
            }

            // Cluster D (VIPurr Villa): enforce max 5 cats per household unit
            if ($hotelSelection['cluster'] === 'D' && $bookedByOwnerId) {
                $householdCount = $this->hotelAllocator->householdPetCount($bookedByOwnerId, $checkIn, $nights);
                if ($householdCount >= 5) {
                    return $this->error('The VIPurr Villa allows a maximum of 5 cats per household unit.', 422);
                }
            }
        }

        $pricesByService = [];
        $basePrice = 0.0;
        foreach ($orderedServices as $svc) {
            $item = collect($bookedItems)->firstWhere('service_id', $svc->id) ?? [];
            if (strtolower((string) $svc->category) === 'hotel') {
                $svcPrice = (float) (($hotelSelection['nightly_rate'] ?? 0) * ((int) ($item['hotel_nights'] ?? $validated['hotel_nights'] ?? 1)));
            } else {
                $tier = ServiceTier::where('service_id', $svc->id)
                    ->where('size_label', $item['size_label'] ?? $validated['size_label'])
                    ->firstOrFail();
                $svcPrice = (float) $tier->price;
            }

            $promotion = $this->pricingService->resolveAppointmentPromotion(
                $validated['promotion_id'] ?? null,
                $primaryService,
                $validated['size_label'] ?? null,
                $validated['appointment_date'],
                $basePrice
            );
            $pricesByService[$svc->id] = $svcPrice;
            $basePrice += $svcPrice;
        }

        // 4. Create appointment
        $appointmentData = [
            'pet_id'               => $validated['pet_id'],
            'service_id'           => $primaryService->id,
            'promotion_id'         => $promotion?->id,
            'hotel_suite_id'       => $validated['hotel_suite_id'] ?? null,
            'booked_by_owner_id'   => $bookedByOwnerId,
            'handled_by'           => $handledById,
            'appointment_date'     => $validated['appointment_date'],
            'start_time'           => $validated['start_time'],
            'special_instructions' => $validated['special_instructions'] ?? null,
            'notes'                => $validated['notes'] ?? null,
            'daycare_duration'     => $validated['daycare_duration'] ?? null,
            'hotel_nights'         => $validated['hotel_nights'] ?? null,
            'size_label'           => $validated['size_label'] ?? null,
            'pet_size'             => $hotelPetSize,
            'status'               => $walkInStartedImmediately ? 'in_progress' : 'approved',
            'actual_check_in_at'   => $walkInStartedImmediately ? now('Asia/Manila') : null,
            'booking_source'       => $validated['booking_source'] ?? 'online',
            'deposit'              => $isHotel ? round($basePrice * 0.5, 2) : null,
            'reference_number'     => $validated['reference_number'] ?? null,
            'reservation_channel'  => $validated['reservation_channel'] ?? null,
            'reservation_provider' => $validated['reservation_provider'] ?? null,
            'reservation_payment_account_id' => $validated['reservation_payment_account_id'] ?? null,
            'reservation_payer_provider' => $validated['reservation_payer_provider'] ?? null,
            'total_price'          => $basePrice,
        ];

        $appointment = Appointment::create($appointmentData);
        $this->createBookedPackages($appointment, $orderedServices, $pricesByService, $appointment->status);

        if ($isDaycare && $extraPets->isNotEmpty()) {
            foreach ($extraPets as $extraPet) {
                $extraData = $appointmentData;
                $extraData['pet_id'] = $extraPet->id;
                $extraData['size_label'] = $daycarePetSizeMap->get((string) $extraPet->id) ?? $appointmentData['size_label'];
                $extraAppointment = Appointment::create($extraData);
                $extraPrices = [];
                foreach ($orderedServices as $svc) {
                    $extraTier = ServiceTier::query()
                        ->where('service_id', $svc->id)
                        ->where('size_label', $extraData['size_label'])
                        ->firstOrFail();
                    $extraPrices[$svc->id] = (float) $extraTier->price;
                }
                $this->createBookedPackages($extraAppointment, $orderedServices, $extraPrices, 'approved');
                if (count($orderedServices) === 1) {
                    $this->pricingService->recalculate($extraAppointment);
                }
                $this->ensureAppointmentAssessment((string) $extraPet->id, (string) $bookedByOwnerId, (string) $extraAppointment->id, (string) $primaryService->id);
            }
        }

        // 5. Attach addons and calculate addon total
        $addonTotal = 0;
        if (!empty($validated['addons'])) {
            $seenAddonIds = [];
            foreach ($validated['addons'] as $addonData) {
                $addon = ServiceAddon::query()->findOrFail($addonData['addon_id']);
                if (!$this->pricingService->addonAppliesToService($addon, $primaryService)) {
                    return $this->error('One or more selected extras are not valid for this service.', 422);
                }
                if ((bool) ($addon->is_active ?? true) !== true) {
                    return $this->error('One or more selected extras are currently inactive.', 422);
                }
                if (in_array((string) $addon->id, $seenAddonIds, true)) {
                    continue;
                }
                $appointment->appointmentAddons()->create([
                    'addon_id'      => $addon->id,
                    'price_charged' => (float) ($addon->price_min ?? 0),
                    'notes'         => $addonData['notes'] ?? null,
                ]);
                $addonTotal += (float) ($addon->price_min ?? 0);
                $seenAddonIds[] = (string) $addon->id;
            }
        }

        // 6. Always derive total from service/package + addons + discount rules.
        if (count($orderedServices) === 1) {
            $this->pricingService->recalculate($appointment);
        }
        if ($isHotel) {
            $appointment->refresh();
            $appointment->update(['deposit' => round((float) $appointment->total_price * 0.5, 2)]);
        }

        // Ensure appointment has an assessment record linked to appointment_id.
        $linked = $this->ensureAppointmentAssessment(
            (string) $appointment->pet_id,
            (string) $bookedByOwnerId,
            (string) $appointment->id,
            (string) $primaryService->id
        );

        if (!$linked) {
            return $this->error('Please complete the Pet Assessment Form for this pet before booking.', 422);
        }

        // Send booking confirmation email
        $relations = ['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons'];
        if ($this->supportsBookedPackages()) {
            $relations[] = 'bookedPackages';
        }
        $loaded = $appointment->load($relations);
        $owner  = $loaded->pet->owner;
        if ($owner?->email) {
            try {
                Mail::to($owner->email)->send(new BookingConfirmationMail($loaded, $owner, $loaded->pet));
            } catch (\Exception $e) {
                \Log::warning('Booking confirmation email failed: ' . $e->getMessage());
            }
        }

        $this->notificationService->create(
            $appointment,
            $walkInStartedImmediately
                ? 'Walk-in Grooming for ' . ($loaded->pet->name ?? 'your pet') . ' has started.'
                : 'Appointment booking for ' . ($loaded->pet->name ?? 'your pet') . ' has been approved.',
            'confirmation',
            'Booking Approved'
        );

        return $this->success(
            $loaded,
            'Appointment booked successfully.',
            201
        );
    });

    }

    /**
     * Update editable fields of an appointment (reschedule, reassign, adjust details).
     * Status changes must use PATCH /appointments/{id}/status instead.
     * PUT /appointments/{appointment}
     */
    public function bookOwn(Request $request)
    {
        $user  = $request->user();
        $owner = $user->owner ?? \App\Models\Owner::where('email', $user->email)->first();

        if (!$owner) {
            return $this->error('Owner profile not found. Please complete your profile.', 403);
        }

        $validated = $request->validate([
            'pet_id'               => 'required|uuid|exists:pets,id',
            'service_id'           => 'required_without:booked_packages|nullable|uuid|exists:services,id',
            'size_label'           => 'nullable|string|max:50',
            'pet_size'             => 'nullable|string|max:20',
            'appointment_date'     => 'required|date|after_or_equal:today',
            'start_time'           => 'required|date_format:H:i,H:i:s',
            'special_instructions' => 'nullable|string|max:500',
            'hotel_suite_id'       => 'nullable|uuid|exists:hotel_suites,id',
            'hotel_nights'         => 'nullable|integer|min:1|max:30',
            'daycare_duration'     => 'nullable|string|in:hourly,half_day,full_day',
            'deposit'              => 'nullable|numeric|min:0',
            'reference_number'     => 'nullable|string|max:30|regex:/^[A-Za-z0-9]+$/',
            'has_deposit_proof'    => 'nullable|boolean',
            'reservation_channel'  => 'nullable|in:e_wallet,bank_transfer',
            'reservation_provider' => 'nullable|string|max:80',
            'reservation_payment_account_id' => 'nullable|string|max:80',
            'reservation_payer_provider' => 'nullable|string|max:80',
            'notes'                => 'nullable|string|max:500',
            'booked_packages'      => 'nullable|array|min:1',
            'booked_packages.*.service_id' => 'required|uuid|exists:services,id',
            'booked_packages.*.size_label' => 'nullable|string|max:50',
            'booked_packages.*.pet_size' => 'nullable|string|max:20',
            'booked_packages.*.appointment_date' => 'nullable|date|after_or_equal:today',
            'booked_packages.*.start_time' => 'nullable|date_format:H:i,H:i:s',
            'booked_packages.*.daycare_duration' => 'nullable|string|in:hourly,half_day,full_day',
            'booked_packages.*.hotel_suite_id' => 'nullable|uuid|exists:hotel_suites,id',
            'booked_packages.*.hotel_nights' => 'nullable|integer|min:1|max:30',
            'additional_pet_ids' => 'nullable|array|max:2',
            'additional_pet_ids.*' => 'uuid|exists:pets,id|distinct',
            'daycare_pet_sizes' => 'nullable|array|max:3',
            'daycare_pet_sizes.*.pet_id' => 'required_with:daycare_pet_sizes|uuid|exists:pets,id',
            'daycare_pet_sizes.*.size_label' => 'required_with:daycare_pet_sizes|string|max:50',
            'addons'               => 'nullable|array',
            'addons.*.addon_id'    => 'required|uuid|exists:service_addons,id',
            'addons.*.price_charged' => 'nullable|numeric|min:0',
            'addons.*.notes'       => 'nullable|string',
        ]);

        // Ensure the pet belongs to this owner
        $pet = \App\Models\Pet::find($validated['pet_id']);
        if (!$pet || $pet->owner_id !== $owner->id) {
            return $this->error('You can only book appointments for your own pets.', 403);
        }

        // Enforce pet-level assessment form completion before booking.

        $hasAssessment = PetHealthForm::query()
            ->where('pet_id', $validated['pet_id'])
            ->where('owner_id', $owner->id)
            ->where('declaration_accepted', true)
            ->exists();

        if (!$hasAssessment) {
            return $this->error('Please complete the Pet Assessment Form for this pet before booking.', 422);
        }

        return DB::transaction(function () use ($validated, $owner, $pet) {
            // Double-booking check (skip for hotel - handled by suite overlap check below)
            $bookedItems = $this->normalizeBookedPackagesInput($validated);
            $serviceIds = collect($bookedItems)->pluck('service_id')->filter()->unique()->values();
            $services = Service::query()->whereIn('id', $serviceIds)->get()->keyBy('id');
            if ($services->count() !== $serviceIds->count()) {
                return $this->error('One or more selected packages are invalid.', 422);
            }

            $compatibilityError = $this->assertBookingCompatibility($services->values()->all());
            if ($compatibilityError) {
                return $this->error($compatibilityError, 422);
            }

            $orderedServices = $this->orderBookedServices($services->values()->all());
            $primaryService = $orderedServices[0] ?? null;
            $isHotel = strtolower((string) ($primaryService?->category ?? '')) === 'hotel';
            $primaryCategory = strtolower((string) ($primaryService?->category ?? ''));
            $hotelPetSize = null;
            if ($isHotel) {
                $hotelItem = collect($bookedItems)->firstWhere('service_id', $primaryService->id) ?? [];
                $pet->loadMissing('speciesType');
                $species = $this->hotelAllocator->normalizeSpecies(
                    $pet->speciesType?->name ?? $pet->speciesType?->code
                );
                $hotelPetSize = $this->hotelAllocator->normalizeConfirmedPetSize(
                    $hotelItem['pet_size'] ?? $validated['pet_size'] ?? null,
                    $species
                );
                if (!$hotelPetSize) {
                    return $this->error('Select a valid Pet Size for the selected pet before booking the hotel suite.', 422);
                }
            }
            $additionalPetIds = collect($validated['additional_pet_ids'] ?? [])
                ->filter(fn ($id) => (string) $id !== (string) $validated['pet_id'])
                ->unique()
                ->values();
            $isPureDaycare = $primaryCategory === 'daycare'
                && collect($orderedServices)->every(fn ($svc) => strtolower((string) ($svc->category ?? '')) === 'daycare');
            $daycarePetSizeMap = collect($validated['daycare_pet_sizes'] ?? [])
                ->filter(fn ($row) => !empty($row['pet_id']) && !empty($row['size_label']))
                ->mapWithKeys(fn ($row) => [(string) $row['pet_id'] => (string) $row['size_label']]);

            if ($additionalPetIds->isNotEmpty() && !$isPureDaycare) {
                return $this->error('Additional pets are only supported for daycare-only bookings.', 422);
            }

            if ($isPureDaycare && (1 + $additionalPetIds->count()) > 3) {
                return $this->error('You may select a maximum of three pets for one daycare booking.', 422);
            }
            if ($isPureDaycare) {
                $allSelectedPetIds = collect([(string) $validated['pet_id']])
                    ->merge($additionalPetIds->map(fn ($id) => (string) $id))
                    ->unique()
                    ->values();
                if ($daycarePetSizeMap->count() !== $allSelectedPetIds->count()) {
                    return $this->error('Please select a daycare size for each selected pet.', 422);
                }
                $missingSizePet = $allSelectedPetIds->first(fn ($petId) => !$daycarePetSizeMap->has((string) $petId));
                if ($missingSizePet) {
                    return $this->error('Please select a daycare size for each selected pet.', 422);
                }
            }

            $extraPets = collect();
            if ($additionalPetIds->isNotEmpty()) {
                $extraPets = \App\Models\Pet::query()
                    ->whereIn('id', $additionalPetIds->all())
                    ->get(['id', 'owner_id']);

                if ($extraPets->count() !== $additionalPetIds->count()) {
                    return $this->error('One or more additional pets were not found.', 422);
                }

                if ($extraPets->contains(fn ($p) => (string) $p->owner_id !== (string) $owner->id)) {
                    return $this->error('You can only add your own pets to daycare bookings.', 403);
                }

                $missingAssessment = $extraPets->first(function ($p) use ($owner) {
                    return !PetHealthForm::query()
                        ->where('pet_id', $p->id)
                        ->where('owner_id', $owner->id)
                        ->where('declaration_accepted', true)
                        ->exists();
                });

                if ($missingAssessment) {
                    return $this->error('Please complete the Pet Assessment Form for all selected pets before booking.', 422);
                }
            }

            if (!$primaryService) {
                return $this->error('At least one service package is required.', 422);
            }
            if ($isHotel) {
                if (empty($validated['hotel_suite_id']) || empty($validated['hotel_nights'])) {
                    return $this->error('Hotel reservations require a suite and number of nights.', 422);
                }
                if (empty($validated['reservation_channel']) || empty($validated['reservation_payment_account_id']) || (empty($validated['reference_number']) && empty($validated['has_deposit_proof']))) {
                    return $this->error('Hotel reservations require a payment destination and either a reference number or proof of payment.', 422);
                }
                if (!$this->configuredPaymentAccount($validated['reservation_payment_account_id'], null)) {
                    return $this->error('The selected receiving payment account is unavailable.', 422);
                }
            }

            if ($isPureDaycare) {
                $pet->loadMissing('speciesType');
                $speciesCode = strtoupper((string) ($pet->speciesType?->code ?? ''));
                $speciesName = strtolower((string) ($pet->speciesType?->name ?? ''));
                if ($speciesCode === 'C' || str_contains($speciesName, 'cat') || str_contains($speciesName, 'feline')) {
                    return $this->error('Daycare services are available for dogs only. Cats cannot be booked due to safety concerns.', 422);
                }

                $daycareDuration = $validated['daycare_duration'] ?? null;
                if (!$daycareDuration) {
                    return $this->error('Duration tier selection is required for daycare bookings.', 422);
                }
                $latestStart = ['hourly' => '17:00:00', 'half_day' => '16:00:00', 'full_day' => '13:00:00'][$daycareDuration];
                if ($this->normalizeClockTime((string) $validated['start_time']) > $latestStart) {
                    return $this->error('The selected daycare start time is too late for the chosen duration.', 422);
                }

                $daycareAvailabilityError = $this->availabilityService->daycareSlotAvailabilityError(
                    $validated['appointment_date'],
                    (string) $validated['start_time'],
                    $daycareDuration,
                    (string) $owner->id,
                    1 + $additionalPetIds->count()
                );
                if ($daycareAvailabilityError) {
                    return $this->error($daycareAvailabilityError, 422);
                }
            }
            $scheduleError = $this->validateBookingWindow(
                $validated['appointment_date'],
                $validated['start_time'] ?? null,
                $primaryService?->category ?? null
            );
            if ($scheduleError) {
                return $scheduleError;
            }

            if (!$isHotel) {
                $requiredUnits = $isPureDaycare ? max(1, 1 + $extraPets->count()) : 1;
                foreach ($orderedServices as $svc) {
                    if ($isPureDaycare && strtolower((string) ($svc->category ?? '')) === 'daycare') {
                        continue;
                    }
                    $item = collect($bookedItems)->firstWhere('service_id', $svc->id) ?? [];
                    $serviceCategory = strtolower((string) ($svc->category ?? ''));
                    if ($serviceCategory === 'grooming') {
                        $this->availabilityService->lockGroomingCapacityForUpdate();
                    }
                    $exists = $this->availabilityService->hasSlotConflict(
                        $item['appointment_date'] ?? $validated['appointment_date'],
                        $item['start_time'] ?? $validated['start_time'],
                        $svc->id,
                        $item['size_label'] ?? $validated['size_label'] ?? null,
                        null,
                        strtolower((string) ($svc->category ?? '')) === 'daycare' ? $requiredUnits : 1
                    );

                    if ($exists) {
                        $isDaycareService = $serviceCategory === 'daycare';
                        $isGroomingService = $serviceCategory === 'grooming';
                        return $this->error(
                            $isDaycareService
                                ? 'Daycare is already reserved. Please choose a different date or time.'
                                : ($isGroomingService
                                    ? 'This time slot is already full. Please select another date or time.'
                                    : 'This time slot is already booked for the selected service.'),
                            $isGroomingService ? 409 : 422
                        );
                    }
                }
            }

            // Lookup service tier price (not used for hotel - priced by suite/night)

            // Hotel overlap checks + cluster decision tree
            $hotelSelection = null;
            if ($isHotel && !empty($validated['hotel_suite_id']) && !empty($validated['hotel_nights'])) {
                $checkIn  = $validated['appointment_date'];
                $nights   = (int) $validated['hotel_nights'];
                $suite    = \App\Models\HotelSuite::find($validated['hotel_suite_id']);

                if (!$suite) {
                    return $this->error('Selected hotel suite was not found.', 422);
                }
                if (!$suite->is_available) {
                    return $this->error('No Hotel Suite is available for the selected dates. Please choose another date or suite.', 409);
                }

                $species = $this->hotelAllocator->normalizeSpecies(
                    $pet?->speciesType?->name ?? $pet?->speciesType?->code
                );
                $dogSize = $species === 'dog'
                    ? $this->hotelAllocator->normalizeDogSize($hotelPetSize)
                    : null;

                $hotelSelection = $this->hotelAllocator->validateSuiteSelection($species ?? '', $dogSize, $suite->name);
                if (!$hotelSelection) {
                    return $this->error('Selected hotel suite does not match the allowed species/size decision tree.', 422);
                }

                $this->hotelAllocator->lockCapacityForUpdate();
                $petOverlap = $this->hasOverlappingHotelBooking(
                    (string) $validated['pet_id'],
                    $checkIn,
                    $nights
                );

                if ($petOverlap) {
                    return $this->error('This pet already has a hotel booking that overlaps the selected dates.', 422);
                }

                $inventory = $this->hotelAllocator->clusterInventory(
                    $hotelSelection['cluster'],
                    $checkIn,
                    $nights,
                    $owner->id
                );

                if (($inventory['available'] ?? 0) <= 0) {
                    return $this->error('No Hotel Suite is available for the selected dates. Please choose another date or suite.', 409);
                }

                // Cluster D (VIPurr Villa): enforce max 5 cats per household unit
                if ($hotelSelection['cluster'] === 'D') {
                    $householdCount = $this->hotelAllocator->householdPetCount($owner->id, $checkIn, $nights);
                    if ($householdCount >= 5) {
                        return $this->error('The VIPurr Villa allows a maximum of 5 cats per household unit.', 422);
                    }
                }
            }

            $pricesByService = [];
            $basePrice = 0.0;
            foreach ($orderedServices as $svc) {
                $item = collect($bookedItems)->firstWhere('service_id', $svc->id) ?? [];
                if (strtolower((string) $svc->category) === 'hotel') {
                    $svcPrice = (float) (($hotelSelection['nightly_rate'] ?? 0) * ((int) ($item['hotel_nights'] ?? $validated['hotel_nights'] ?? 1)));
                } else {
                    $effectiveSizeLabel = (strtolower((string) $svc->category) === 'daycare' && $isPureDaycare)
                        ? ($daycarePetSizeMap->get((string) $validated['pet_id']) ?? ($item['size_label'] ?? $validated['size_label']))
                        : ($item['size_label'] ?? $validated['size_label']);
                    $tier = ServiceTier::where('service_id', $svc->id)
                        ->where('size_label', $effectiveSizeLabel)
                        ->firstOrFail();
                    $svcPrice = (float) $tier->price;
                }
                $pricesByService[$svc->id] = $svcPrice;
                $basePrice += $svcPrice;
            }

            $appointmentData = [
                'pet_id'               => $validated['pet_id'],
                'service_id'           => $primaryService->id,
                'hotel_suite_id'       => $validated['hotel_suite_id'] ?? null,
                'booked_by_owner_id'   => $owner->id,
                'handled_by'           => null,
                'appointment_date'     => $validated['appointment_date'],
                'start_time'           => $validated['start_time'],
                'special_instructions' => $validated['special_instructions'] ?? null,
                'notes'                => $validated['notes'] ?? null,
                'daycare_duration'     => $validated['daycare_duration'] ?? null,
                'hotel_nights'         => $validated['hotel_nights'] ?? null,
                'size_label'           => $isPureDaycare
                    ? ($daycarePetSizeMap->get((string) $validated['pet_id']) ?? $validated['size_label'])
                    : $validated['size_label'],
                'pet_size'             => $hotelPetSize,
                'status'               => 'pending',
                'deposit'              => $isHotel ? round($basePrice * 0.5, 2) : null,
                'reference_number'     => $validated['reference_number'] ?? null,
                'reservation_channel'  => $validated['reservation_channel'] ?? null,
                'reservation_provider' => $validated['reservation_provider'] ?? null,
                'reservation_payment_account_id' => $validated['reservation_payment_account_id'] ?? null,
                'reservation_payer_provider' => $validated['reservation_payer_provider'] ?? null,
                'capacity_hold_expires_at' => $isHotel ? now('Asia/Manila')->addMinutes(30) : null,
                'is_full_day_package'  => false,
                'grooming_discount'    => null,
                'total_price'          => $basePrice,
            ];
            $appointment = Appointment::create($appointmentData);

            $this->createBookedPackages($appointment, $orderedServices, $pricesByService, 'pending');
            if (!empty($validated['addons'])) {
                foreach ($validated['addons'] as $addonData) {
                    $addon = ServiceAddon::findOrFail($addonData['addon_id']);
                    $appointment->appointmentAddons()->create([
                        'addon_id'      => $addon->id,
                        'price_charged' => $addonData['price_charged'] ?? $addon->price_min,
                        'notes'         => $addonData['notes'] ?? null,
                    ]);
                }
            }
            if (count($orderedServices) === 1) {
                $this->pricingService->recalculate($appointment);
            }
            if ($isHotel) {
                $appointment->refresh();
                $appointment->update(['deposit' => round((float) $appointment->total_price * 0.5, 2)]);
            }

            if ($isPureDaycare && $extraPets->isNotEmpty()) {
                foreach ($extraPets as $extraPet) {
                    $extraData = $appointmentData;
                    $extraData['pet_id'] = $extraPet->id;
                    $extraData['size_label'] = $daycarePetSizeMap->get((string) $extraPet->id) ?? $appointmentData['size_label'];
                    $extraAppointment = Appointment::create($extraData);
                    $extraPricesByService = [];
                    foreach ($orderedServices as $svc) {
                        $item = collect($bookedItems)->firstWhere('service_id', $svc->id) ?? [];
                        if (strtolower((string) $svc->category) === 'hotel') {
                            $extraPricesByService[$svc->id] = (float) (($hotelSelection['nightly_rate'] ?? 0) * ((int) ($item['hotel_nights'] ?? $validated['hotel_nights'] ?? 1)));
                        } else {
                            $extraTier = ServiceTier::where('service_id', $svc->id)
                                ->where('size_label', $extraData['size_label'] ?? ($item['size_label'] ?? $validated['size_label']))
                                ->firstOrFail();
                            $extraPricesByService[$svc->id] = (float) $extraTier->price;
                        }
                    }
                    $this->createBookedPackages($extraAppointment, $orderedServices, $extraPricesByService, 'pending');
                    if (count($orderedServices) === 1) {
                        $this->pricingService->recalculate($extraAppointment);
                    }
                    $this->ensureAppointmentAssessment(
                        (string) $extraAppointment->pet_id,
                        (string) $owner->id,
                        (string) $extraAppointment->id,
                        (string) $primaryService->id
                    );
                }
            }

            // Ensure appointment has an assessment record linked to appointment_id.
            $linked = $this->ensureAppointmentAssessment(
                (string) $appointment->pet_id,
                (string) $owner->id,
                (string) $appointment->id,
                (string) $primaryService->id
            );

            if (!$linked) {
                return $this->error('Please complete the Pet Assessment Form for this pet before booking.', 422);
            }

            $relations = ['pet', 'service', 'hotelSuite'];
            if ($this->supportsBookedPackages()) {
                $relations[] = 'bookedPackages';
            }
            $loaded = $appointment->load($relations);

            $this->notificationService->create(
                $appointment,
                'New appointment booking for ' . ($loaded->pet->name ?? 'your pet') . ' is pending admin approval.',
                'confirmation',
                'New Booking'
            );

            return $this->success(
                $loaded,
                'Appointment booked successfully.',
                201
            );
        });
    }

    /**
     * Customer updates their own pending/approved appointment.
     * PUT /my-appointments/{appointment}
     */

    private function success($data, string $message = '', int $status = 200): JsonResponse
    { return response()->json(['status' => $status, 'message' => $message, 'data' => $data], $status); }

    private function error(string $message, int $status = 400, array $errors = []): JsonResponse
    { return response()->json(['status' => $status, 'message' => $message, 'data' => $errors], $status); }

    private function configuredPaymentAccount(?string $accountId, ?string $reservationChannel): ?array
    {
        if (!$accountId) {
            return null;
        }

        $expectedType = $reservationChannel === 'e_wallet'
            ? 'ewallet'
            : ($reservationChannel === 'bank_transfer' ? 'bank' : null);

        foreach (ShopHoursSetting::get('payment_accounts', []) as $account) {
            if ((string) ($account['id'] ?? '') !== (string) $accountId) {
                continue;
            }

            if ($expectedType && (string) ($account['type'] ?? '') !== $expectedType) {
                return null;
            }

            return $account;
        }

        return null;
    }

    private function authorize($ability, $arguments = []): void
    { Gate::authorize($ability, $arguments); }
    protected function supportsBookedPackages(): bool
    {
        if ($this->hasBookedPackagesTable !== null) {
            return $this->hasBookedPackagesTable;
        }

        $this->hasBookedPackagesTable = Schema::hasTable('appointment_booked_packages');
        return $this->hasBookedPackagesTable;
    }
    protected function appointmentsColumns(): array
    {
        if ($this->appointmentsTableColumns !== null) {
            return $this->appointmentsTableColumns;
        }

        $this->appointmentsTableColumns = Schema::hasTable('appointments')
            ? Schema::getColumnListing('appointments')
            : [];

        return $this->appointmentsTableColumns;
    }
    protected function filterExistingAppointmentColumns(array $columns): array
    {
        $existing = array_flip($this->appointmentsColumns());
        return array_values(array_filter($columns, fn($column) => isset($existing[$column])));
    }
    protected function ensureAppointmentAssessment(
        string $petId,
        ?string $ownerId,
        string $appointmentId,
        ?string $serviceId = null
    ): bool {
        $exists = PetHealthForm::query()
            ->where('appointment_id', $appointmentId)
            ->exists();

        if ($exists) {
            return true;
        }

        $dayStart = Carbon::now('Asia/Manila')->startOfDay()->utc();
        $dayEnd = Carbon::now('Asia/Manila')->endOfDay()->utc();
        $assessmentQuery = PetHealthForm::query()
            ->where('pet_id', $petId)
            ->when($ownerId, fn($q) => $q->where('owner_id', $ownerId))
            ->where('declaration_accepted', true);

        $todayAssessment = (clone $assessmentQuery)
            ->where(function ($query) use ($dayStart, $dayEnd) {
                $query->whereBetween('created_at', [$dayStart, $dayEnd])
                    ->orWhereBetween('updated_at', [$dayStart, $dayEnd]);
            })
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();

        // The pre-create validation accepts any completed assessment. Keep this
        // post-create linkage check consistent so it cannot report failure after
        // the appointment has already been inserted.
        $assessment = $todayAssessment ?: $assessmentQuery
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->first();

        if ($assessment && !$assessment->appointment_id) {
            $assessment->appointment_id = $appointmentId;
            if ($serviceId) {
                $assessment->service_id = $serviceId;
            }
            $assessment->save();
        }

        return (bool) $assessment;
    }
    protected function hasOverlappingHotelBooking(
        string $petId,
        string $checkIn,
        int $nights,
        ?string $excludeAppointmentId = null
    ): bool {
        $checkOut = Carbon::parse($checkIn, 'Asia/Manila')->addDays(max(1, $nights))->toDateString();

        return Appointment::query()
            ->where('pet_id', $petId)
            ->when($excludeAppointmentId, fn ($q) => $q->whereKeyNot($excludeAppointmentId))
            ->whereNotIn('status', ['cancelled', 'completed', 'no_show', 'rejected'])
            ->where(function ($statusQuery) {
                $statusQuery->where('status', '!=', 'pending')
                    ->orWhere('capacity_hold_expires_at', '>', now('Asia/Manila'));
            })
            ->whereHas('service', fn ($q) => $q->where('category', 'hotel'))
            ->where(function ($overlapQuery) use ($checkIn, $checkOut) {
                $overlapQuery
                    ->where(function ($scheduledQuery) use ($checkIn, $checkOut) {
                        $scheduledQuery->where('appointment_date', '<', $checkOut);
                        $scheduledQuery->whereRaw($this->availabilityService->hotelStayEndsAfterSql(), [$checkIn]);
                    })
                    ->orWhere(function ($checkedInQuery) {
                        $checkedInQuery
                            ->whereNotNull('actual_check_in_at')
                            ->whereNull('actual_check_out_at')
                            ->where('actual_check_in_at', '<=', now('Asia/Manila'));
                    });
            })
            ->exists();
    }
    protected function validateBookingWindow(string $date, ?string $startTime, ?string $serviceCategory, ?string $bookingSource = null)
    {
        $category = strtolower((string) $serviceCategory);
        $immediateGroomingWalkIn = $category === 'grooming'
            && $bookingSource === 'walk_in'
            && $this->availabilityService->isImmediateGroomingWalkIn($date, $startTime);

        if (strtolower((string) $serviceCategory) === 'hotel') {
            $availableTimes = $this->availabilityService->hotelCheckInSlotsForDate($date);
            $adminTimeAllowed = $this->isAdminHotelCheckInTimeAllowed($date, $startTime);
            if (!$availableTimes && !$adminTimeAllowed) {
                return $this->error('No Hotel Suite check-in times are available for the selected date.', 422);
            }
            if (!$startTime || (!in_array($this->normalizeClockTime($startTime), $availableTimes, true) && !$adminTimeAllowed)) {
                return $this->error('The selected check-in time is no longer available. Please choose an available Hotel Suite time.', 422);
            }
        }

        if (!$immediateGroomingWalkIn && $this->appointmentTimeHasPassed($date, $startTime)) {
            return $this->error('You cannot book an appointment for a time that has already passed.', 422);
        }

        $blockedDates = \App\Models\ShopHoursSetting::get('blocked_dates', []);
        if (in_array($date, $blockedDates, true)) {
            return $this->error('Clinic is closed on the selected date.', 422);
        }

        $dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        $shortKeys = ['sunday' => 'sun', 'monday' => 'mon', 'tuesday' => 'tue', 'wednesday' => 'wed', 'thursday' => 'thu', 'friday' => 'fri', 'saturday' => 'sat'];
        $dayOfWeek = $dayNames[(int) date('w', strtotime($date))];
        $shortKey = $shortKeys[$dayOfWeek] ?? null;
        $shopHoursSaved = \App\Models\ShopHoursSetting::get('shop_hours', []);
        $dayStr = $shortKey ? ($shopHoursSaved[$shortKey] ?? null) : null;

        if ($dayStr !== null && strtolower(trim((string) $dayStr)) === 'closed') {
            return $this->error('Clinic is closed on the selected day.', 422);
        }

        // For non-hotel services, require a time and enforce it falls inside open/close window.
        if (strtolower((string) $serviceCategory) !== 'hotel') {
            if (!$startTime) {
                return $this->error('Time slot is required for this service.', 422);
            }

            if ($category === 'grooming' && !$immediateGroomingWalkIn
                && !$this->availabilityService->isValidGroomingStart($date, $startTime)) {
                return $this->error('The selected Grooming time is no longer available. Please choose an available time slot.', 422);
            }

            if ($category === 'grooming' || $immediateGroomingWalkIn) {
                return null;
            }

            $normalizedStart = $this->normalizeClockTime($startTime);
            $open = '09:00:00';
            $close = '17:00:00';

            if ($dayStr !== null && trim((string) $dayStr) !== '') {
                $normalizedDay = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $dayStr);
                if (preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $normalizedDay, $m)) {
                    $open = date('H:i:s', strtotime("{$m[1]} {$m[2]}"));
                    $close = date('H:i:s', strtotime("{$m[3]} {$m[4]}"));
                }
            }

            if ($normalizedStart < $open || $normalizedStart >= $close) {
                return $this->error('Booking time must be within the configured clinic hours for the selected day.', 422);
            }

        }

        return null;
    }
    protected function isAdminHotelCheckInTimeAllowed(string $date, ?string $startTime): bool
    {
        if (!in_array(strtolower((string) Auth::user()?->role), ['admin', 'staff'], true) || !$startTime) {
            return false;
        }

        $time = $this->normalizeClockTime($startTime);
        if ($time < '09:00:00' || $time > '17:00:00') {
            return false;
        }

        try {
            $checkInDate = Carbon::createFromFormat('!Y-m-d', substr($date, 0, 10), 'Asia/Manila');
            if (!$checkInDate || $checkInDate->format('Y-m-d') !== substr($date, 0, 10)) return false;
        } catch (\Throwable) {
            return false;
        }

        if (in_array($date, ShopHoursSetting::get('blocked_dates', []), true)) return false;
        $hotelDays = ShopHoursSetting::get('schedule.hotel', [])['days'] ?? [];
        if ($hotelDays && !in_array($checkInDate->dayOfWeek, array_map('intval', $hotelDays), true)) return false;

        $dayHours = ShopHoursSetting::get('shop_hours', [])[strtolower($checkInDate->format('D'))] ?? null;
        if (!$dayHours || strtolower(trim((string) $dayHours)) === 'closed') return false;
        $dayHours = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $dayHours);
        if (!preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $dayHours, $matches)) return false;

        $opening = date('H:i:s', strtotime("{$matches[1]} {$matches[2]}"));
        $closing = date('H:i:s', strtotime("{$matches[3]} {$matches[4]}"));
        return $time >= $opening && $time <= $closing;
    }
    protected function appointmentTimeHasPassed(string $date, ?string $startTime): bool
    {
        if (!$date || !$startTime) {
            return false;
        }

        $nowManila = \Illuminate\Support\Carbon::now('Asia/Manila');
        if ($date !== $nowManila->toDateString()) {
            return false;
        }

        return $this->normalizeClockTime($startTime) <= $nowManila->format('H:i:s');
    }
    protected function isWithinShopHoursNow(): bool
    {
        $now = \Illuminate\Support\Carbon::now('Asia/Manila');
        $shopHoursSaved = \App\Models\ShopHoursSetting::get('shop_hours', []);
        $shortKey = strtolower($now->format('D')); // sun, mon, tue...
        $dayStr = $shortKey ? ($shopHoursSaved[$shortKey] ?? null) : null;

        // Fall back to legacy policy if shop hours are not configured.
        if ($dayStr === null || trim((string) $dayStr) === '') {
            $current = $now->format('H:i:s');
            return $current >= '09:00:00' && $current <= '17:00:00';
        }

        if (strtolower(trim((string) $dayStr)) === 'closed') {
            return false;
        }

        $normalizedDay = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $dayStr);
        if (preg_match('/(\\d{1,2}:\\d{2})\\s*(AM|PM)\\s*-\\s*(\\d{1,2}:\\d{2})\\s*(AM|PM)/i', $normalizedDay, $m)) {
            $open = \Illuminate\Support\Carbon::createFromFormat('g:i A', "{$m[1]} {$m[2]}", 'Asia/Manila');
            $close = \Illuminate\Support\Carbon::createFromFormat('g:i A', "{$m[3]} {$m[4]}", 'Asia/Manila');
            if (!$open || !$close) {
                return false;
            }

            $openToday = $now->copy()->setTimeFrom($open);
            $closeToday = $now->copy()->setTimeFrom($close);

            return $now->betweenIncluded($openToday, $closeToday);
        }

        return false;
    }
    protected function normalizeClockTime(?string $time): string
    {
        $normalized = substr((string) $time, 0, 8);
        if (strlen($normalized) === 5) {
            $normalized .= ':00';
        }

        return $normalized;
    }
    protected function serviceDurationMinutes(string $serviceId, ?string $sizeLabel = null): int
    {
        static $serviceCategoryCache = [];
        static $durationCache = [];

        $durationKey = $serviceId . '|' . strtolower(trim((string) $sizeLabel));
        if (isset($durationCache[$durationKey])) {
            return $durationCache[$durationKey];
        }

        if (!array_key_exists($serviceId, $serviceCategoryCache)) {
            $serviceCategoryCache[$serviceId] = strtolower((string) (Service::query()->where('id', $serviceId)->value('category') ?? ''));
        }

        $serviceCategory = $serviceCategoryCache[$serviceId];
        if ($serviceCategory === 'grooming') {
            return $durationCache[$durationKey] = 60;
        }

        $query = ServiceTier::query()->where('service_id', $serviceId);

        if ($sizeLabel) {
            $tier = (clone $query)
                ->whereRaw('LOWER(size_label) = ?', [strtolower(trim($sizeLabel))])
                ->first();

            if ($tier && (float) $tier->duration_hours > 0) {
                return $durationCache[$durationKey] = max(15, (int) round(((float) $tier->duration_hours) * 60));
            }
        }

        $fallbackHours = (float) $query->max('duration_hours');

        return $durationCache[$durationKey] = $fallbackHours > 0
            ? max(15, (int) round($fallbackHours * 60))
            : 60;
    }
    protected function appointmentTimeRange(Appointment $appointment): ?array
    {
        if (!$appointment->appointment_date || !$appointment->start_time || !$appointment->service_id) {
            return null;
        }

        $date = $appointment->appointment_date instanceof \Carbon\Carbon
            ? $appointment->appointment_date->format('Y-m-d')
            : \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d');

        $start = \Carbon\Carbon::parse($date . ' ' . $this->normalizeClockTime($appointment->start_time), 'Asia/Manila');
        $duration = $this->serviceDurationMinutes((string) $appointment->service_id, $appointment->size_label);

        return [$start, $start->copy()->addMinutes($duration)];
    }
    protected function normalizeBookedPackagesInput(array $validated): array
    {
        if (!empty($validated['booked_packages']) && is_array($validated['booked_packages'])) {
            return array_values($validated['booked_packages']);
        }

        return [[
            'service_id' => $validated['service_id'] ?? null,
            'size_label' => $validated['size_label'] ?? null,
            'pet_size' => $validated['pet_size'] ?? null,
            'appointment_date' => $validated['appointment_date'] ?? null,
            'start_time' => $validated['start_time'] ?? null,
            'daycare_duration' => $validated['daycare_duration'] ?? null,
            'hotel_suite_id' => $validated['hotel_suite_id'] ?? null,
            'hotel_nights' => $validated['hotel_nights'] ?? null,
        ]];
    }
    protected function orderBookedServices(array $services): array
    {
        usort($services, function ($a, $b) {
            $rank = fn(string $cat): int => match (strtolower($cat)) {
                'grooming' => 1,
                'daycare' => 2,
                'hotel' => 3,
                default => 99,
            };
            return $rank($a->category ?? '') <=> $rank($b->category ?? '');
        });

        return $services;
    }
    protected function assertBookingCompatibility(array $services): ?string
    {
        $categories = collect($services)->map(fn($svc) => strtolower((string) ($svc->category ?? '')))->unique()->values();
        $hasHotel = $categories->contains('hotel');

        if ($hasHotel && $categories->count() > 1) {
            return 'Hotel packages cannot be combined with Grooming or Daycare in one appointment transaction.';
        }

        return null;
    }
    protected function nextBookedPackageId(string $packageId): string
    {
        $last = AppointmentBookedPackage::query()
            ->where('package_id', $packageId)
            ->selectRaw("MAX(CAST(split_part(booked_package_id, '-', 2) AS INTEGER)) as seq")
            ->value('seq');

        $seq = ((int) $last) + 1;
        return $packageId . '-' . $seq;
    }
    protected function createBookedPackages(Appointment $appointment, array $orderedServices, array $pricesByService, string $status): void
    {
        if (!$this->supportsBookedPackages()) {
            return;
        }

        foreach ($orderedServices as $index => $svc) {
            $packageId = (string) ($svc->display_id ?? '');
            if ($packageId === '') {
                continue;
            }

            AppointmentBookedPackage::create([
                'booked_package_id' => $this->nextBookedPackageId($packageId),
                'appointment_id' => $appointment->id,
                'service_id' => $svc->id,
                'package_id' => $packageId,
                'service_type' => strtolower((string) $svc->category),
                'package_name' => (string) ($svc->name ?? ''),
                'sequence_order' => $index + 1,
                'status' => $status,
                'price' => (float) ($pricesByService[$svc->id] ?? 0),
            ]);
        }
    }
    protected function petSmartId($pet): ?string
    {
        if (!$pet) {
            return null;
        }

        return $pet->pet_id ?? null;
    }
    protected function groomerAssignmentError(?User $staff): ?string
    {
        if (!$staff || !$staff->isStaff() || !$staff->isGroomer()) {
            return 'Select an active Groomer for this grooming service.';
        }

        if (!$staff->is_active) {
            return 'The selected Groomer is inactive.';
        }

        if (!$this->attendanceService->isCurrentlyOnDuty($staff)) {
            return 'The selected Groomer must Time In and be Currently On Duty before being assigned.';
        }

        return null;
    }
}
