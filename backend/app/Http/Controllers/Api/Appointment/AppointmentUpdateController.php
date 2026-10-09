<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateAppointmentRequest;
use App\Models\Appointment;
use App\Models\PetHealthForm;
use App\Models\Service;
use App\Models\User;
use App\Models\ServiceAddon;
use App\Models\ShopHoursSetting;
use App\Services\HotelClusterAllocator;
use App\Services\HotelExtensionService;
use App\Services\AppointmentPricingService;
use App\Services\AppointmentNotificationService;
use App\Services\AppointmentAvailabilityService;
use App\Services\StaffCommissionService;
use App\Services\StaffAttendanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class AppointmentUpdateController extends Controller
{
    public function __construct(
        protected readonly HotelClusterAllocator $hotelAllocator,
        protected readonly HotelExtensionService $hotelExtensionService,
        protected readonly AppointmentPricingService $pricingService,
        protected readonly AppointmentNotificationService $notificationService,
        protected readonly AppointmentAvailabilityService $availabilityService,
        protected readonly StaffCommissionService $commissionService,
        protected readonly StaffAttendanceService $attendanceService,
    )
    {
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

    protected function validateEditableFieldsForStatus(Appointment $appointment, array $validated): ?string
    {
        $status = strtolower((string) ($appointment->status ?? 'pending'));
        $depositReferenceFields = ['deposit', 'reference_number'];

        $allowedByStatus = [
            'pending' => [
                'service_id', 'appointment_date', 'start_time', 'size_label', 'pet_size', 'handled_by',
                'hotel_suite_id', 'daycare_duration', 'hotel_nights', 'check_out_time',
                'actual_check_in_at', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
                'actual_check_out_at', 'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes', 'special_instructions', 'notes', 'addons',
            ],
            'approved' => array_merge([
                'service_id', 'size_label', 'pet_size', 'daycare_duration', 'hotel_suite_id',
                'appointment_date', 'start_time', 'handled_by', 'hotel_nights', 'check_out_time',
                'actual_check_in_at', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
                'actual_check_out_at', 'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes', 'special_instructions', 'notes', 'addons',
            ], $depositReferenceFields),
            'in_progress' => array_merge([
                'handled_by', 'pet_size', 'hotel_nights', 'check_out_time', 'actual_check_in_at', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
                'actual_check_out_at', 'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes', 'special_instructions', 'notes', 'addons',
            ], $depositReferenceFields),
            'completed' => array_merge([
                'notes', 'special_instructions', 'pet_size',
                'actual_check_in_at', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
                'actual_check_out_at', 'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes',
            ], $depositReferenceFields),
            'cancelled' => [],
            'no_show' => [],
        ];

        $allowed = $allowedByStatus[$status] ?? [];
        $blocked = array_values(array_diff(array_keys($validated), $allowed));

        if (!empty($blocked)) {
            return 'These fields cannot be edited while appointment status is ' . str_replace('_', ' ', $status) . ': ' . implode(', ', $blocked) . '.';
        }

        if (in_array($status, ['cancelled', 'no_show'], true) && !empty($validated)) {
            return 'Finalized appointments cannot be edited.';
        }

        if ($status === 'in_progress') {
            $serviceCategory = strtolower((string) ($appointment->service?->category ?? ''));
            $hotelFields = ['hotel_nights', 'check_out_time'];
            $requestedHotelFields = array_intersect(array_keys($validated), $hotelFields);
            if ($serviceCategory !== 'hotel' && !empty($requestedHotelFields)) {
                return 'Hotel extension fields can only be edited for hotel appointments.';
            }
        }

        return null;
    }

    public function update(UpdateAppointmentRequest $request, Appointment $appointment)
    {
        $this->authorize('update', $appointment);

        if ($request->user()?->isGroomer()) {
            return $this->error('Groomers may update service notes only through the assigned service workflow.', 403);
        }

        $validated = $request->validated();

        if ($message = $this->validateEditableFieldsForStatus($appointment->loadMissing('service'), $validated)) {
            return $this->error($message, 422);
        }

        if (!empty($validated['handled_by'])) {
            $staff = User::query()->find($validated['handled_by']);
            if (!$staff || !$staff->isStaff()) {
                return $this->error('Selected staff member is invalid.', 422);
            }
        }

        if (!empty($validated['service_id']) && (string) $validated['service_id'] !== (string) $appointment->service_id) {
            $appointment->loadMissing('service');
            $newService = Service::query()->find($validated['service_id']);
            $currentCategory = strtolower((string) ($appointment->service?->category ?? ''));
            $newCategory = strtolower((string) ($newService?->category ?? ''));

            if (!$newService || $newCategory !== $currentCategory) {
                return $this->error('Service category cannot be changed. Please select a package from the same category.', 422);
            }
        }

        $targetServiceId = $validated['service_id'] ?? $appointment->service_id;
        $targetService = Service::query()->find($targetServiceId);
        $targetCategory = strtolower((string) ($targetService?->category ?? $appointment->service?->category ?? ''));
        if ($targetCategory === 'grooming'
            && !empty($validated['handled_by'])
            && (string) $validated['handled_by'] !== (string) $appointment->handled_by) {
            if ($error = $this->groomerAssignmentError(User::query()->find($validated['handled_by']))) {
                return $this->error($error, 422);
            }
        }
        if (array_key_exists('promotion_id', $validated)) {
            $targetSize = $validated['size_label'] ?? $appointment->size_label;
            $targetDateForPromotion = $validated['appointment_date'] ?? $appointment->appointment_date;
            $targetBasePrice = $this->pricingService->rawAppointmentBasePrice(
                $targetService,
                $validated['hotel_suite_id'] ?? $appointment->hotel_suite_id,
                $validated['hotel_nights'] ?? $appointment->hotel_nights,
                $targetSize
            );
            $this->pricingService->resolveAppointmentPromotion(
                $validated['promotion_id'],
                $targetService,
                $targetSize,
                $targetDateForPromotion,
                $targetBasePrice
            );
            $validated['promotion_title_snapshot'] = null;
            $validated['promotion_type_snapshot'] = null;
            $validated['promotion_value_snapshot'] = null;
            $validated['promotion_original_price'] = null;
            $validated['promotion_discount_amount'] = null;
            $validated['promotion_final_price'] = null;
        }
        if (array_key_exists('pet_size', $validated)) {
            if ($targetCategory !== 'hotel') {
                return $this->error('Pet Size can only be updated for Hotel Suite appointments.', 422);
            }
            $appointment->loadMissing('pet.speciesType');
            $species = $this->hotelAllocator->normalizeSpecies(
                $appointment->pet?->speciesType?->name ?? $appointment->pet?->speciesType?->code
            );
            $petSize = $this->hotelAllocator->normalizeConfirmedPetSize($validated['pet_size'], $species);
            if (!$petSize) {
                return $this->error('Select a valid Pet Size for the selected pet.', 422);
            }
            $validated['pet_size'] = $petSize;
        }
        $isPawsomeExtras = strtolower(trim((string) ($targetService?->name ?? ''))) === 'pawsome extras';
        if ($isPawsomeExtras && array_key_exists('addons', $validated)) {
            $selectedAddonCount = count($validated['addons'] ?? []);
            if ($selectedAddonCount < 1 || $selectedAddonCount > 3) {
                return $this->error('Select 1 to 3 Pawsome Extras before saving.', 422);
            }
            $selectedAddonIds = collect($validated['addons'])->pluck('addon_id')->filter()->values();
            $selectedExtras = ServiceAddon::query()->whereIn('id', $selectedAddonIds)->get();
            $selectedGroups = $selectedExtras->map(fn (ServiceAddon $addon) => strtolower(trim((string) preg_replace('/\s*-\s*(S|M|L|XL|XXL)$/i', '', (string) $addon->name))));
            if ($selectedGroups->unique()->count() !== $selectedGroups->count()) {
                return $this->error('Select only one size for each Pawsome Extra.', 422);
            }
        }
        $hotelOperationalFields = [
            'actual_check_in_at',
            'late_checkin_reason',
            'late_checkin_other_reason',
            'late_checkin_staff_notes',
            'actual_check_out_at',
            'late_checkout_notes',
            'late_checkout_reason',
            'late_checkout_other_reason',
            'late_checkout_staff_notes',
        ];
        $requestedHotelOperationalFields = array_values(array_intersect(array_keys($validated), $hotelOperationalFields));
        if ($targetCategory !== 'hotel' && !empty($requestedHotelOperationalFields)) {
            return $this->error('Hotel checkout tracking fields are only available for hotel appointments.', 422);
        }
        if ($targetCategory === 'hotel') {
            $now = now('Asia/Manila');
            $checkInValue = array_key_exists('actual_check_in_at', $validated)
                ? $validated['actual_check_in_at']
                : $appointment->actual_check_in_at;
            $checkOutValue = array_key_exists('actual_check_out_at', $validated)
                ? $validated['actual_check_out_at']
                : $appointment->actual_check_out_at;

            if (array_key_exists('actual_check_in_at', $validated)) {
                if (!in_array($appointment->status, ['approved', 'in_progress'], true)) {
                    return $this->error('Actual check-in can only be corrected for an approved or in-progress Hotel Suite appointment.', 422);
                }
                if (!$validated['actual_check_in_at'] && $appointment->actual_check_in_at) {
                    return $this->error('A recorded Hotel Suite check-in cannot be cleared.', 422);
                }
                if ($validated['actual_check_in_at'] && Carbon::parse($validated['actual_check_in_at'], 'Asia/Manila')->isAfter($now)) {
                    return $this->error('Actual check-in cannot be in the future.', 422);
                }
            }

            if ($checkInValue && $checkOutValue) {
                $checkIn = Carbon::parse($checkInValue, 'Asia/Manila');
                $checkOut = Carbon::parse($checkOutValue, 'Asia/Manila');
                if ($checkOut->isAfter($now)) {
                    return $this->error('Actual check-out cannot be in the future.', 422);
                }
                if ($checkOut->lessThan($checkIn)) {
                    return $this->error('Actual check-out must be on or after the recorded check-in.', 422);
                }
            }

            if (array_key_exists('actual_check_out_at', $validated)
                && $validated['actual_check_out_at']
                && $appointment->status !== 'in_progress') {
                return $this->error('Actual check-out can only be recorded while the Hotel Suite appointment is in progress.', 422);
            }
            if (array_key_exists('actual_check_out_at', $validated)
                && !$validated['actual_check_out_at']
                && $appointment->actual_check_out_at) {
                return $this->error('A recorded Hotel Suite check-out cannot be cleared.', 422);
            }
        }

        if (($validated['late_checkout_reason'] ?? null) === 'other' && trim((string) ($validated['late_checkout_other_reason'] ?? '')) === '') {
            return $this->error('Additional Notes is required when Late Check-Out Reason is Other.', 422);
        }
        if (($validated['late_checkin_reason'] ?? null) === 'other' && trim((string) ($validated['late_checkin_other_reason'] ?? '')) === '') {
            return $this->error('Additional Notes is required when Late Check-In Reason is Other.', 422);
        }

        $targetDate = $validated['appointment_date'] ?? ($appointment->appointment_date
            ? \Carbon\Carbon::parse($appointment->appointment_date)->toDateString()
            : null);
        $targetTime = $validated['start_time'] ?? $appointment->start_time;

        if (($appointment->booking_source ?? null) === 'walk_in'
            && array_key_exists('appointment_date', $validated)
            && $targetDate !== \Illuminate\Support\Carbon::now('Asia/Manila')->toDateString()) {
            return $this->error('Walk-in appointments are only available for today.', 422);
        }

        $currentDate = $appointment->appointment_date
            ? \Carbon\Carbon::parse($appointment->appointment_date)->toDateString()
            : null;
        $requestedDate = isset($validated['appointment_date'])
            ? \Carbon\Carbon::parse($validated['appointment_date'])->toDateString()
            : $currentDate;
        $currentStartTime = $this->availabilityService->normalizeClockTime((string) ($appointment->start_time ?? ''));
        $requestedStartTime = isset($validated['start_time'])
            ? $this->availabilityService->normalizeClockTime((string) $validated['start_time'])
            : $currentStartTime;
        $requestedHotelSuiteId = $validated['hotel_suite_id'] ?? $appointment->hotel_suite_id;
        $requestedHotelNights = (int) ($validated['hotel_nights'] ?? $appointment->hotel_nights ?? 0);
        $scheduleChanged = $requestedDate !== $currentDate
            || $requestedStartTime !== $currentStartTime
            || (string) $targetServiceId !== (string) $appointment->service_id
            || (string) $requestedHotelSuiteId !== (string) $appointment->hotel_suite_id
            || $requestedHotelNights !== (int) ($appointment->hotel_nights ?? 0);

        // Existing past appointments may still need package, status, or operational edits.
        // Only a real schedule change must pass the booking-window validation.
        if ($scheduleChanged) {
            if ($requestedDate && $requestedDate < now('Asia/Manila')->toDateString()) {
                return $this->error('Appointment date cannot be moved into the past.', 422);
            }
            $isImmediateGroomingWalkIn = $targetCategory === 'grooming'
                && ($appointment->booking_source ?? null) === 'walk_in'
                && $this->availabilityService->isImmediateGroomingWalkIn($targetDate, $targetTime);
            if ($targetDate && ($scheduleError = $this->validateBookingWindow(
                $targetDate,
                $targetTime,
                $targetCategory,
                $isImmediateGroomingWalkIn ? 'walk_in' : null
            ))) {
                return $scheduleError;
            }
        }

        if ($targetCategory === 'hotel') {
            $targetReservationChannel = $validated['reservation_channel'] ?? $appointment->reservation_channel;
            $targetPaymentAccountId = $validated['reservation_payment_account_id'] ?? $appointment->reservation_payment_account_id;
            if ($targetReservationChannel && $targetReservationChannel !== 'cash'
                && !$this->configuredPaymentAccount($targetPaymentAccountId, $targetReservationChannel)) {
                return $this->error('The selected receiving payment account is unavailable.', 422);
            }
            $hotelSuiteId = $requestedHotelSuiteId;
            $hotelNights = $requestedHotelNights;
            if (!$hotelSuiteId || $hotelNights < 1) {
                return $this->error('Hotel package and stay length are required.', 422);
            }
            if ($scheduleChanged && ($message = $this->availabilityService->validateHotelStayAvailability(
                $appointment,
                $targetDate,
                $hotelNights,
                $hotelSuiteId,
                $validated['pet_size'] ?? $appointment->pet_size
            ))) {
                return $this->error($message, str_starts_with($message, 'No Hotel Suite is available') ? 409 : 422);
            }
        }

        // Block double-booking only when the effective schedule actually changes.
        // Edit forms may resend unchanged date/time/service values while updating
        // package details such as daycare duration or size.
        $groomingDurationChanged = $targetCategory === 'grooming'
            && array_key_exists('size_label', $validated)
            && (string) ($validated['size_label'] ?? '') !== (string) ($appointment->size_label ?? '');

        $savedUnderGroomingLock = false;
        if ($targetCategory === 'grooming' && ($scheduleChanged || $groomingDurationChanged)) {
            $newDate = $validated['appointment_date'] ?? $appointment->appointment_date;
            $newTime = $validated['start_time'] ?? $appointment->start_time;
            $newServiceId = $validated['service_id'] ?? $appointment->service_id;
            $conflict = DB::transaction(function () use ($appointment, $validated, $newDate, $newTime, $newServiceId) {
                $this->availabilityService->lockGroomingCapacityForUpdate();
                if ($this->availabilityService->hasSlotConflict(
                    (string) $newDate,
                    (string) $newTime,
                    (string) $newServiceId,
                    $validated['size_label'] ?? $appointment->size_label,
                    (string) $appointment->id
                )) {
                    return true;
                }
                $appointment->update($validated);
                return false;
            });
            if ($conflict) {
                return $this->error('This time slot is already full. Please select another date or time.', 409);
            }
            $savedUnderGroomingLock = true;
        } elseif ($targetCategory !== 'hotel' && ($scheduleChanged || $groomingDurationChanged)) {
            $newDate = $validated['appointment_date'] ?? $appointment->appointment_date;
            $newTime = $validated['start_time'] ?? $appointment->start_time;
            $newServiceId = $validated['service_id'] ?? $appointment->service_id;
            if ($this->availabilityService->hasSlotConflict(
                $newDate,
                $newTime,
                $newServiceId,
                $validated['size_label'] ?? $appointment->size_label,
                $appointment->id
            )) {
                return $this->error('This time slot is already booked for the selected service.', 422);
            }
        }

        $previousActualCheckIn = $appointment->actual_check_in_at?->toIso8601String();
        if ($targetCategory === 'hotel' && $scheduleChanged) {
            $availabilityError = DB::transaction(function () use (
                $appointment,
                $validated,
                $targetDate,
                $requestedHotelNights,
                $requestedHotelSuiteId
            ) {
                $this->hotelAllocator->lockCapacityForUpdate();
                $message = $this->availabilityService->validateHotelStayAvailability(
                    $appointment,
                    (string) $targetDate,
                    $requestedHotelNights,
                    (string) $requestedHotelSuiteId,
                    $validated['pet_size'] ?? $appointment->pet_size
                );
                if ($message) {
                    return $message;
                }
                $appointment->update($validated);
                return null;
            });
            if ($availabilityError) {
                return $this->error($availabilityError, str_starts_with($availabilityError, 'No Hotel Suite is available') ? 409 : 422);
            }
        } elseif (!$savedUnderGroomingLock) {
            $appointment->update($validated);
        }
        if (array_key_exists('actual_check_in_at', $validated)
            && $previousActualCheckIn !== $appointment->actual_check_in_at?->toIso8601String()) {
            \Log::info('Hotel check-in timestamp recorded or corrected.', [
                'appointment_id' => $appointment->id,
                'actual_check_in_at' => $appointment->actual_check_in_at?->toIso8601String(),
                'updated_by' => $request->user()?->id,
            ]);
        }

        // Sync add-ons when provided from edit flow.
        if (array_key_exists('addons', $validated)) {
            $appointment->appointmentAddons()->delete();
            $seenAddonIds = [];
            foreach (($validated['addons'] ?? []) as $addonData) {
                $addon = ServiceAddon::query()->find($addonData['addon_id'] ?? null);
                if (!$addon) {
                    continue;
                }
                if (!$this->pricingService->addonAppliesToService($addon, $appointment->service)) {
                    continue;
                }
                if ((bool) ($addon->is_active ?? true) !== true) {
                    continue;
                }
                if (in_array((string) $addon->id, $seenAddonIds, true)) {
                    continue;
                }
                $appointment->appointmentAddons()->create([
                    'addon_id' => $addon->id,
                    'price_charged' => (float) ($addon->price_min ?? 0),
                ]);
                $seenAddonIds[] = (string) $addon->id;
            }
        }

        // Always derive operational total from service/package + addons + discount rules.
        $appointment->refresh();
        $this->pricingService->recalculate($appointment);

        return $this->success(
            $appointment->fresh()->load(['pet', 'service', 'hotelSuite', 'appointmentAddons', 'handledBy'])
                ->append(Appointment::DETAIL_APPENDS),
            'Appointment updated successfully.'
        );
    }

    public function updateOwn(Request $request, Appointment $appointment)
    {
        $owner = $request->user()->owner
            ?? \App\Models\Owner::where('email', $request->user()->email)->first();

        if (!$owner || $appointment->booked_by_owner_id !== $owner->id) {
            return $this->error('Unauthorized.', 403);
        }

        // Allow hotel extension on in_progress hotel appointments
        $appointment->loadMissing('service');
        $isHotelExtension = strtolower((string) ($appointment->service?->category ?? '')) === 'hotel'
            && $appointment->status === 'in_progress'
            && $request->has('hotel_nights')
            && count($request->only(['hotel_nights'])) === count($request->except(['_method', '_token']));

        if (!$isHotelExtension && !in_array($appointment->status, ['pending', 'approved'])) {
            return $this->error('Only pending or approved appointments can be edited.', 422);
        }

        // Hotel extension: only allowed within 24 hours before checkout
        if ($isHotelExtension) {
            $checkInDate = \Carbon\Carbon::parse($appointment->appointment_date)->startOfDay();
            $nights = (int) ($appointment->hotel_nights ?? 1);
            $startTime = $appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time)->format('H:i') : '10:00';
            $checkoutDateTime = $checkInDate->copy()->addDays($nights)->setTimeFromTimeString($startTime);
            $now = \Carbon\Carbon::now('Asia/Manila');
            $hoursUntilCheckout = $now->diffInMinutes($checkoutDateTime, false) / 60;

            if ($hoursUntilCheckout > 24) {
                return $this->error('Stay extension is only available within 24 hours before your scheduled check-out.', 422);
            }
        }

        $validated = $request->validate([
            'service_id'           => 'sometimes|uuid|exists:services,id',
            'appointment_date'     => 'sometimes|date|after_or_equal:today',
            'start_time'           => 'sometimes|date_format:H:i,H:i:s',
            'size_label'           => 'sometimes|nullable|string|max:50',
            'pet_size'             => 'sometimes|nullable|string|max:20',
            'special_instructions' => 'sometimes|nullable|string|max:500',
            'hotel_nights'         => 'sometimes|nullable|integer|min:1|max:30',
        ]);

        if (array_key_exists('pet_size', $validated)) {
            $appointment->loadMissing('service', 'pet.speciesType');
            if (strtolower((string) ($appointment->service?->category ?? '')) !== 'hotel') {
                return $this->error('Pet Size can only be updated for Hotel Suite appointments.', 422);
            }
            $species = $this->hotelAllocator->normalizeSpecies(
                $appointment->pet?->speciesType?->name ?? $appointment->pet?->speciesType?->code
            );
            $petSize = $this->hotelAllocator->normalizeConfirmedPetSize($validated['pet_size'], $species);
            if (!$petSize) {
                return $this->error('Select a valid Pet Size for the selected pet.', 422);
            }
            $validated['pet_size'] = $petSize;
        }

        // Double-booking checks for non-Grooming categories keep their existing path.
        $checkDate    = $validated['appointment_date'] ?? $appointment->appointment_date;
        $checkTime    = $validated['start_time']       ?? $appointment->start_time;
        $checkService = $validated['service_id']       ?? $appointment->service_id;
        $targetCategory = strtolower((string) Service::query()->whereKey($checkService)->value('category'));
        $serviceChanged = (string) $checkService !== (string) $appointment->service_id;
        $sizeChanged = array_key_exists('size_label', $validated)
            && (string) ($validated['size_label'] ?? '') !== (string) ($appointment->size_label ?? '');
        if ($targetCategory !== 'grooming') {
            $conflict = $this->availabilityService->hasSlotConflict(
                $checkDate,
                $checkTime,
                $checkService,
                $validated['size_label'] ?? $appointment->size_label,
                $appointment->id
            );
            if ($conflict) {
                return $this->error('This time slot is already booked for the selected service.', 422);
            }
        }

        $wasApproved = strtolower((string) $appointment->status) === 'approved';
        $originalDate = optional($appointment->appointment_date)->format('Y-m-d')
            ?? substr((string) $appointment->appointment_date, 0, 10);
        $originalTime = substr((string) $appointment->start_time, 0, 5);
        $requestedDate = substr((string) ($validated['appointment_date'] ?? $originalDate), 0, 10);
        $requestedTime = substr((string) ($validated['start_time'] ?? $originalTime), 0, 5);
        $scheduleChanged = $requestedDate !== $originalDate
            || $requestedTime !== $originalTime
            || $serviceChanged
            || (array_key_exists('hotel_nights', $validated)
                && (int) $validated['hotel_nights'] !== (int) $appointment->hotel_nights);
        $groomingScheduleCheck = $targetCategory === 'grooming' && ($scheduleChanged || $sizeChanged);

        if ($wasApproved && $scheduleChanged) {
            $validated['status'] = 'pending';
            if (Schema::hasColumn('appointments', 'reschedule_requested_at')) {
                $validated['reschedule_requested_at'] = now('Asia/Manila');
            } else {
                $existingNotes = trim((string) $appointment->notes);
                $marker = sprintf('[Reschedule Request] New schedule: %s at %s.', $requestedDate, $requestedTime);
                $validated['notes'] = trim($existingNotes . "\n" . $marker);
            }
        }
        if ($scheduleChanged
            && !$isHotelExtension
            && strtolower((string) ($appointment->service?->category ?? '')) === 'hotel'
            && Schema::hasColumn('appointments', 'capacity_hold_expires_at')) {
            $validated['capacity_hold_expires_at'] = now('Asia/Manila')->addMinutes(30);
        }

        if ($scheduleChanged
            && !$isHotelExtension
            && strtolower((string) ($appointment->service?->category ?? '')) === 'hotel') {
            $appointment->loadMissing('pet.speciesType', 'hotelSuite');
            $availabilityError = DB::transaction(function () use (
                $appointment,
                $validated,
                $requestedDate
            ) {
                $this->hotelAllocator->lockCapacityForUpdate();
                $message = $this->availabilityService->validateHotelStayAvailability(
                    $appointment,
                    $requestedDate,
                    (int) ($validated['hotel_nights'] ?? $appointment->hotel_nights ?? 0),
                    (string) $appointment->hotel_suite_id,
                    $validated['pet_size'] ?? $appointment->pet_size
                );
                if ($message) {
                    return $message;
                }
                $appointment->update($validated);
                return null;
            });
            if ($availabilityError) {
                return $this->error($availabilityError, str_starts_with($availabilityError, 'No Hotel Suite is available') ? 409 : 422);
            }
        } elseif ($groomingScheduleCheck) {
            $isCurrentWalkIn = ($appointment->booking_source ?? null) === 'walk_in'
                && $this->availabilityService->isImmediateGroomingWalkIn($requestedDate, $requestedTime);
            if ((!$isCurrentWalkIn && $this->appointmentTimeHasPassed($requestedDate, $requestedTime))
                || (!$isCurrentWalkIn && !$this->availabilityService->isValidGroomingStart($requestedDate, $requestedTime))) {
                return $this->error('The selected Grooming time is no longer available. Please choose an available time slot.', 422);
            }
            $conflict = DB::transaction(function () use ($appointment, $validated, $requestedDate, $requestedTime, $checkService) {
                $this->availabilityService->lockGroomingCapacityForUpdate();
                if ($this->availabilityService->hasSlotConflict(
                    $requestedDate,
                    $requestedTime,
                    (string) $checkService,
                    $validated['size_label'] ?? $appointment->size_label,
                    (string) $appointment->id
                )) {
                    return true;
                }
                $appointment->update($validated);
                return false;
            });
            if ($conflict) {
                return $this->error('This time slot is already full. Please select another date or time.', 409);
            }
        } else {
            $appointment->update($validated);
        }

        // Always derive total from service/package + addons + discount rules.
        $this->pricingService->recalculate($appointment);
        $updated = $appointment->fresh()->load(['pet', 'service']);

        if ($wasApproved && $scheduleChanged) {
            $this->notificationService->create(
                $updated,
                sprintf(
                    'Reschedule request for %s to %s at %s is pending admin approval.',
                    $updated->pet?->name ?? 'your pet',
                    $requestedDate,
                    $requestedTime
                ),
                'reschedule_request',
                'Reschedule Pending Approval'
            );
        }

        return $this->success(
            $updated,
            $wasApproved && $scheduleChanged
                ? 'Reschedule request submitted and is pending admin approval.'
                : 'Appointment updated successfully.'
        );
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
            if (!$startTime || (!in_array($this->availabilityService->normalizeClockTime($startTime), $availableTimes, true) && !$adminTimeAllowed)) {
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

            $normalizedStart = $this->availabilityService->normalizeClockTime($startTime);
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

        $time = $this->availabilityService->normalizeClockTime($startTime);
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

    protected function configuredPaymentAccount(?string $accountId, ?string $reservationChannel): ?array
    {
        if (!$accountId) {
            return null;
        }

        $expectedType = $reservationChannel === 'e_wallet' ? 'ewallet' : ($reservationChannel === 'bank_transfer' ? 'bank' : null);
        foreach (\App\Models\ShopHoursSetting::get('payment_accounts', []) as $account) {
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

    protected function appointmentTimeHasPassed(string $date, ?string $startTime): bool
    {
        if (!$date || !$startTime) {
            return false;
        }

        $nowManila = \Illuminate\Support\Carbon::now('Asia/Manila');
        if ($date !== $nowManila->toDateString()) {
            return false;
        }

        return $this->availabilityService->normalizeClockTime($startTime) <= $nowManila->format('H:i:s');
    }

}
