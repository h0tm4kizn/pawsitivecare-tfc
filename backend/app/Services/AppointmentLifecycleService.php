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

class AppointmentLifecycleService
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

    public function updateStatus(UpdateAppointmentStatusRequest $request, Appointment $appointment)
    {
        $this->authorize('updateStatus', $appointment);

        $validated = $request->validated();

        $validTransitions = [
            'pending'     => ['approved', 'cancelled'],
            'approved'   => ['in_progress', 'cancelled', 'no_show'],
            'in_progress' => ['completed', 'cancelled'],
            'completed'   => [],
            'cancelled'   => [],
            'no_show'     => [],
        ];

        $currentStatus = $appointment->status;
        $newStatus     = $validated['status'];
        $appointment->loadMissing('service');
        if ($request->user()?->isGroomer()) {
            if ((string) $appointment->handled_by !== (string) $request->user()->id
                || strtolower((string) $appointment->service?->category) !== 'grooming'
                || !in_array($newStatus, ['in_progress', 'completed'], true)) {
                return $this->error('Groomers may only update the status of their assigned grooming services.', 403);
            }
            if (!empty($validated['handled_by']) && (string) $validated['handled_by'] !== (string) $request->user()->id) {
                return $this->error('A Groomer cannot reassign an appointment.', 403);
            }
        }
        $isHotelAppointment = strtolower((string) ($appointment->service?->category ?? '')) === 'hotel';
        $appointmentDate = $appointment->appointment_date
            ? \Illuminate\Support\Carbon::parse($appointment->appointment_date, 'Asia/Manila')->toDateString()
            : null;
        $today = \Illuminate\Support\Carbon::now('Asia/Manila')->toDateString();
        $isPastAppointmentDate = $appointmentDate && $appointmentDate < $today;

        if ($newStatus === 'completed' && array_key_exists('confirm_hotel_stay_completed', $validated)) {
            return $this->completeMissedHotelStay($request, $appointment, $validated);
        }

        if (!empty($validated['handled_by'])) {
            $staff = User::query()->find($validated['handled_by']);
            if (!$staff || !$staff->isStaff()) {
                return $this->error('Selected groomer is invalid.', 422);
            }

            if (strtolower((string) ($appointment->service?->category ?? '')) === 'grooming'
                && (string) $validated['handled_by'] !== (string) $appointment->handled_by) {
                if ($error = $this->groomerAssignmentError($staff)) {
                    return $this->error($error, 422);
                }
            }
        }

        if ($newStatus === 'cancelled' && trim((string) ($validated['cancellation_reason'] ?? '')) === '') {
            return $this->error('Cancellation reason is required when cancelling an appointment.', 422);
        }

        if ($newStatus === 'completed' && strtolower((string) ($appointment->service?->category ?? '')) === 'grooming' && empty($validated['handled_by']) && empty($appointment->handled_by)) {
            return $this->error('Please select who groomed the pet before completing this appointment.', 422);
        }

        // Treat duplicate status updates as a no-op to avoid UX-breaking 422s
        if ($newStatus === $currentStatus) {
            if ($newStatus === 'completed' && !$appointment->completed_at) {
                $appointment->completed_at = now('Asia/Manila');
                $appointment->save();
            }
            if ($newStatus === 'completed') {
                $this->commissionService->earnForCompletedAppointment($appointment->fresh());
            }
            return $this->success($appointment, 'Appointment status is already up to date.');
        }

        // Block invalid status transitions
        $isPastApprovedCompletion = $currentStatus === 'approved'
            && $newStatus === 'completed'
            && $isPastAppointmentDate;

        if ($isHotelAppointment && $newStatus === 'completed'
            && ($currentStatus !== 'in_progress' || !$appointment->actual_check_in_at)) {
            return $this->error('Record the actual Hotel Suite check-in and start the stay before completing this appointment.', 422);
        }

        if ((!$isPastApprovedCompletion || $isHotelAppointment) && !in_array($newStatus, $validTransitions[$currentStatus] ?? [], true)) {
            return $this->error(
                "Invalid status transition from {$currentStatus} to {$newStatus}.",
                422
            );
        }

        if ($isHotelAppointment && $newStatus === 'completed') {
            if ($currentStatus !== 'in_progress' || !$appointment->actual_check_in_at) {
                return $this->error('Record the actual Hotel Suite check-in and start the stay before completing this appointment.', 422);
            }
            $checkOutValue = $validated['actual_check_out_at'] ?? $appointment->actual_check_out_at;
            if (!$checkOutValue) {
                return $this->error('Confirm the actual check-out date and time before completing this Hotel Suite appointment.', 422);
            }
            $actualCheckOut = \Illuminate\Support\Carbon::parse($checkOutValue, 'Asia/Manila');
            if ($actualCheckOut->isFuture()) {
                return $this->error('Actual check-out cannot be in the future.', 422);
            }
            if ($actualCheckOut->lessThan($appointment->actual_check_in_at)) {
                return $this->error('Actual check-out must be on or after the recorded check-in.', 422);
            }
        }

        if ($isHotelAppointment && $newStatus === 'in_progress') {
            if ($currentStatus !== 'approved') {
                return $this->error('Only an approved Hotel Suite appointment can be checked in.', 422);
            }
            if (!empty($validated['actual_check_in_at'])) {
                $actualCheckIn = \Illuminate\Support\Carbon::parse($validated['actual_check_in_at'], 'Asia/Manila');
                if ($actualCheckIn->isFuture()) {
                    return $this->error('Actual check-in cannot be in the future.', 422);
                }
                $previousActualCheckIn = $appointment->actual_check_in_at?->toIso8601String();
                $appointment->actual_check_in_at = $actualCheckIn;
                if ($previousActualCheckIn !== $actualCheckIn->toIso8601String()) {
                    \Log::info('Hotel check-in timestamp recorded or corrected during status transition.', [
                        'appointment_id' => $appointment->id,
                        'actual_check_in_at' => $actualCheckIn->toIso8601String(),
                        'updated_by' => $request->user()?->id,
                    ]);
                }
            } elseif (!$appointment->actual_check_in_at) {
                return $this->error('Confirm the actual check-in date and time before starting this Hotel Suite stay.', 422);
            }
        }

        if ($newStatus === 'no_show' && !$this->canMarkNoShow($appointment)) {
            return $this->error('No Show can only be set after the 15-minute grace period.', 422);
        }
        if ($newStatus === 'no_show' && $isHotelAppointment && $appointment->actual_check_in_at) {
            return $this->error('A Hotel Suite appointment with a recorded check-in cannot be marked as No-Show.', 422);
        }

        // Record check-in/check-out timestamps
        if ($newStatus === 'in_progress' && !$isHotelAppointment) {
            if ($appointmentDate !== $today) {
                return $this->error('In Progress status is only allowed for today\'s appointments.', 422);
            }

            $now = now('Asia/Manila');
            $appointment->actual_check_in_at = $now;
        }
        if (!$isHotelAppointment && in_array($newStatus, ['completed', 'cancelled', 'no_show'], true)) {
            $now = now('Asia/Manila');
            $appointment->actual_check_out_at = $now;
        }

        if ($newStatus === 'approved') {
            $approvalError = DB::transaction(function () use (&$appointment, $newStatus) {
                $appointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
                $appointment->loadMissing(['service', 'pet.speciesType', 'hotelSuite']);
                $category = strtolower((string) ($appointment->service?->category ?? ''));

                if ($category === 'grooming' && $appointment->status === 'pending') {
                    $this->availabilityService->lockGroomingCapacityForUpdate();
                    if (!$this->availabilityService->isValidGroomingStart(
                        $appointment->appointment_date->toDateString(),
                        $this->availabilityService->normalizeClockTime((string) $appointment->start_time)
                    )) {
                        return 'The selected appointment time is outside Grooming shop hours or no longer valid.';
                    }
                    if ($this->availabilityService->hasSlotConflict(
                        $appointment->appointment_date->toDateString(),
                        (string) $appointment->start_time,
                        (string) $appointment->service_id,
                        $appointment->size_label,
                        (string) $appointment->id
                    )) {
                        return 'This time slot is already full. Please select another date or time.';
                    }
                }

                if ($category === 'hotel') {
                    if (!$appointment->hotel_suite_id || !$appointment->hotel_nights || !$appointment->hotelSuite) {
                        return 'Hotel reservations require a suite and number of nights before approval.';
                    }

                    $this->hotelAllocator->lockCapacityForUpdate();
                    HotelSuite::query()->whereKey($appointment->hotel_suite_id)->lockForUpdate()->first();
                    $species = $this->hotelAllocator->normalizeSpecies(
                        $appointment->pet?->speciesType?->name ?? $appointment->pet?->speciesType?->code
                    );
                    $confirmedPetSize = $this->hotelAllocator->normalizeConfirmedPetSize(
                        $appointment->pet_size,
                        $species
                    );
                    if (!$confirmedPetSize) {
                        return 'Hotel reservations require a confirmed Pet Size before approval.';
                    }
                    $dogSize = $species === 'dog'
                        ? $this->hotelAllocator->normalizeDogSize($confirmedPetSize)
                        : null;
                    $selection = $this->hotelAllocator->validateSuiteSelection($species ?? '', $dogSize, $appointment->hotelSuite->name);
                    if (!$selection) {
                        return 'Selected hotel suite no longer matches the pet species/size rules.';
                    }

                    $inventory = $this->hotelAllocator->clusterInventory(
                        $selection['cluster'],
                        $appointment->appointment_date->toDateString(),
                        (int) $appointment->hotel_nights,
                        $appointment->booked_by_owner_id,
                        (string) $appointment->id
                    );
                    if (($inventory['available'] ?? 0) <= 0) {
                        return 'No Hotel Suite is available for the selected dates. Please choose another date or suite.';
                    }
                    $appointment->capacity_hold_expires_at = null;
                }

                $appointment->status = $newStatus;
                $appointment->save();
                return null;
            });
            if ($approvalError) {
                $status = str_starts_with($approvalError, 'This time slot is already full.')
                    || str_starts_with($approvalError, 'No Hotel Suite is available')
                    ? 409
                    : 422;
                return $this->error($approvalError, $status);
            }

            $loaded = $appointment->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons']);
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
                'Appointment booking for ' . ($loaded->pet->name ?? 'your pet') . ' has been approved.',
                'confirmation',
                'Appointment Approved'
            );

            return $this->success($appointment, 'Appointment status updated successfully.');
        }

        if ($newStatus === 'completed' && $isHotelAppointment) {
            return $this->completeHotelCheckout($request, $appointment, $validated);
        }

        if ($newStatus === 'completed') {
            $totalPrice = (float) ($appointment->total_price ?? 0);

            if ($isHotelAppointment) {
                $appointment->loadMissing(['hotelSuite', 'appointmentAddons']);
                $hotelServiceTotal = $this->pricingService->resolveBasePriceFromServicePackage($appointment)
                    + (float) $appointment->appointmentAddons()->sum('price_charged');
                $totalPrice = max($totalPrice, $hotelServiceTotal);
                $appointment->total_price = $totalPrice;
            }
            if (!empty($validated['handled_by'])) {
                $appointment->handled_by = $validated['handled_by'];
            } elseif (!$appointment->handled_by && $request->user()?->isStaff()) {
                $appointment->handled_by = $request->user()->id;
            }
            $completedNow = now('Asia/Manila');
            $appointment->completed_at = $completedNow;
            if ($isHotelAppointment) {
                $appointment->actual_check_out_at = \Illuminate\Support\Carbon::parse(
                    $validated['actual_check_out_at'] ?? $appointment->actual_check_out_at,
                    'Asia/Manila'
                );
            } else {
                $appointment->actual_check_out_at = $completedNow;
            }
            $appointment->status = $newStatus;
            $appointment->save();
            $this->commissionService->earnForCompletedAppointment($appointment->fresh());

            if ($isPastApprovedCompletion) {
                \Log::info('Appointment completed from approved status without in_progress.', [
                    'appointment_id' => $appointment->id,
                    'appointment_code' => $appointment->appointment_code,
                    'previous_status' => $currentStatus,
                    'new_status' => $newStatus,
                    'updated_by' => $request->user()?->id,
                ]);
            }

            $loaded = $appointment->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons']);
            $owner = $loaded->pet->owner;
            if ($owner?->email) {
                try {
                    Mail::to($owner->email)->send(new ThankYouMail($loaded, $owner, $loaded->pet));
                } catch (\Exception $e) {
                    \Log::warning('Thank you email failed: ' . $e->getMessage());
                }
            }

            return $this->success($appointment, 'Appointment status updated successfully.');
        }

        if ($newStatus === 'cancelled' && array_key_exists('cancellation_reason', $validated)) {
            $appointment->cancellation_reason = $this->cancellationReasonWithTiming($appointment, $validated['cancellation_reason']);
        } elseif ($newStatus === 'cancelled') {
            $appointment->cancellation_reason = $this->cancellationReasonWithTiming($appointment, $appointment->cancellation_reason);
        }

        if ($newStatus === 'cancelled') {
            $appointment->cancelled_at = now('Asia/Manila');
            $appointment->cancelled_by = $request->user()?->id;
            $appointment->cancellation_type = $currentStatus === 'pending'
                ? 'staff_rejection'
                : 'staff_cancellation';
        }

        if ($newStatus === 'no_show' && array_key_exists('cancellation_reason', $validated)) {
            $appointment->cancellation_reason = $validated['cancellation_reason'];
        }

        // Optional hotel reservation deposit reference updates.
        if ($isHotelAppointment && array_key_exists('deposit', $validated)) {
            $appointment->deposit = is_null($validated['deposit']) ? null : (float) $validated['deposit'];
        }
        if (array_key_exists('reference_number', $validated)) {
            $appointment->reference_number = $validated['reference_number'] ?: null;
        }

        $appointment->status = $newStatus;
        $appointment->save();

        if ($newStatus === 'cancelled') {
            $loaded = $appointment->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite']);
            $owner  = $loaded->pet->owner;
            $reason = trim((string) ($appointment->cancellation_reason ?? ''));

            if ($owner?->email) {
                try {
                    Mail::to($owner->email)->send(new AppointmentCancelledMail($loaded, $owner, $loaded->pet, $reason));
                } catch (\Exception $e) {
                    \Log::warning('Appointment cancelled email failed: ' . $e->getMessage());
                }
            }

            $displayReason = CustomerAppointmentFormatter::reason($reason);
            $this->notificationService->create(
                $appointment,
                'Appointment booking for ' . ($loaded->pet->name ?? 'your pet') . ' has been cancelled.' . ($displayReason ? ' Reason: ' . $displayReason : ''),
                'followup',
                'Appointment Cancelled'
            );
        }

        if ($newStatus === 'no_show') {
            $loaded = $appointment->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite']);
            $owner  = $loaded->pet->owner;
            $reason = trim((string) ($appointment->cancellation_reason ?? ''));

            if ($owner?->email) {
                try {
                    Mail::to($owner->email)->send(new AppointmentNoShowMail($loaded, $owner, $loaded->pet, $reason));
                } catch (\Exception $e) {
                    \Log::warning('Appointment no-show email failed: ' . $e->getMessage());
                }
            }

            $displayReason = CustomerAppointmentFormatter::reason($reason);
            $this->notificationService->create(
                $appointment,
                'Appointment booking for ' . ($loaded->pet->name ?? 'your pet') . ' was marked as no show.' . ($displayReason ? ' Reason: ' . $displayReason : ''),
                'followup',
                'Appointment No Show'
            );
        }

        return $this->success($appointment, 'Appointment status updated successfully.');
    }

    private function completeHotelCheckout(UpdateAppointmentStatusRequest $request, Appointment $appointment, array $validated)
    {
        $completed = DB::transaction(function () use ($appointment, $validated, $request) {
            $locked = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            $locked->load(['service', 'pet.speciesType', 'hotelSuite', 'appointmentAddons']);
            if ($locked->status !== 'in_progress' || !$locked->actual_check_in_at
                || strtolower((string) $locked->service?->category) !== 'hotel') {
                throw ValidationException::withMessages(['status' => 'This Hotel Suite stay is no longer eligible for checkout.']);
            }
            $actual = Carbon::parse($validated['actual_check_out_at'] ?? $locked->actual_check_out_at, 'Asia/Manila');
            if ($actual->isFuture() || $actual->lessThanOrEqualTo($locked->actual_check_in_at)) {
                throw ValidationException::withMessages(['actual_check_out_at' => 'Enter a valid actual checkout after check-in and not in the future.']);
            }
            $preview = $this->hotelExtensionService->preview($locked, $actual);
            $handledBy = $validated['handled_by'] ?? $locked->handled_by ?? $request->user()?->id;
            $charge = $this->hotelExtensionService->record(
                $locked, $preview, $validated, $handledBy, $request->user()?->id
            );
            $hotelServiceTotal = $this->pricingService->resolveBasePriceFromServicePackage($locked)
                + (float) $locked->appointmentAddons()->sum('price_charged');
            $locked->total_price = max((float) $locked->total_price, $hotelServiceTotal);
            $locked->handled_by = $handledBy;
            $locked->actual_check_out_at = $actual;
            $locked->completed_at = now('Asia/Manila');
            $locked->status = 'completed';
            $locked->save();
            if ($charge) {
                $this->logHotelExtensionPayment($request, $locked, $charge);
            } else {
                $this->logHotelCheckoutCompletion($request, $locked);
            }
            return $locked;
        });

        $this->commissionService->earnForCompletedAppointment($completed->fresh());
        $loaded = $completed->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons', 'hotelExtensionCharge']);
        if ($loaded->pet?->owner?->email) {
            try {
                Mail::to($loaded->pet->owner->email)->send(new ThankYouMail($loaded, $loaded->pet->owner, $loaded->pet));
            } catch (\Exception $e) {
                \Log::warning('Thank you email failed: ' . $e->getMessage());
            }
        }
        return $this->success($loaded, 'Appointment status updated successfully.');
    }

    private function logHotelExtensionPayment(
        UpdateAppointmentStatusRequest $request,
        Appointment $appointment,
        HotelExtensionCharge $charge
    ): void
    {
        AuditLog::create([
            'user_id' => $request->user()?->id,
            'actor_name' => $request->user()?->name,
            'actor_email' => $request->user()?->email,
            'action' => 'hotel_extension_paid',
            'method' => 'PATCH',
            'route' => '/api/appointments/{appointment}/status',
            'status_code' => 200,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000) ?: null,
            'metadata' => [
                'module' => 'Appointments',
                'description' => 'Hotel Suite Extended Stay Charge',
                'appointment_id' => (string) $appointment->id,
                'appointment_code' => $appointment->appointment_code,
                'extension_charge_id' => (string) $charge->id,
                'scheduled_check_out_at' => $charge->scheduled_checkout_at?->toIso8601String(),
                'actual_check_out_at' => $charge->actual_checkout_at?->toIso8601String(),
                'extra_minutes' => $charge->extra_minutes,
                'billable_hours' => $charge->billable_hours,
                'pet_species' => $charge->pet_species,
                'pet_size' => $charge->pet_size,
                'daycare_tier_label' => $charge->daycare_tier_label,
                'hourly_rate' => $charge->hourly_rate,
                'extension_charge' => $charge->amount,
                'payment_amount' => $charge->payment_amount,
                'payment_method' => $charge->payment_method,
                'payment_status' => $charge->payment_status,
                'payment_reference' => $charge->payment_reference,
                'handled_by_id' => $charge->handled_by,
                'handled_by_name' => $charge->handledBy?->name,
                'handled_by_display_id' => $charge->handledBy?->display_id,
                'recorded_by_id' => $charge->recorded_by,
                'recorded_by_name' => $request->user()?->name,
                'recorded_at' => $charge->recorded_at?->toIso8601String(),
            ],
        ]);
    }

    private function logHotelCheckoutCompletion(Request $request, Appointment $appointment): void
    {
        $appointment->loadMissing(['service', 'handledBy']);
        $recordedAt = Carbon::now('Asia/Manila');
        $actor = $request->user();
        $appointment->append(['scheduled_check_in_at', 'scheduled_check_out_at']);
        $scheduledCheckIn = $appointment->scheduled_check_in_at?->copy()->timezone('Asia/Manila');
        $scheduledCheckOut = $appointment->scheduled_check_out_at?->copy()->timezone('Asia/Manila');

        AuditLog::create([
            'user_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_email' => $actor?->email,
            'action' => 'hotel_checkout_completed',
            'method' => 'PATCH',
            'route' => '/api/appointments/{appointment}/status',
            'status_code' => 200,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000) ?: null,
            'metadata' => [
                'module' => 'Appointments',
                'description' => 'Hotel Stay Checked Out',
                'appointment_id' => (string) $appointment->id,
                'appointment_code' => $appointment->appointment_code,
                'previous_status' => 'in_progress',
                'new_status' => 'completed',
                'scheduled_check_in_at' => $scheduledCheckIn?->toIso8601String(),
                'scheduled_check_out_at' => $scheduledCheckOut?->toIso8601String(),
                'actual_check_in_at' => $appointment->actual_check_in_at?->copy()->timezone('Asia/Manila')->toIso8601String(),
                'actual_check_out_at' => $appointment->actual_check_out_at?->copy()->timezone('Asia/Manila')->toIso8601String(),
                'handled_by_id' => $appointment->handled_by,
                'handled_by_name' => $appointment->handledBy?->name,
                'recorded_by_id' => $actor?->id,
                'recorded_by_name' => $actor?->name,
                'recorded_by_role' => $this->formatStaffRole($actor),
                'recorded_at' => $recordedAt->toIso8601String(),
            ],
            'created_at' => $recordedAt,
        ]);
    }

    private function completeMissedHotelStay(
        UpdateAppointmentStatusRequest $request,
        Appointment $appointment,
        array $validated
    ) {
        if (($validated['confirm_hotel_stay_completed'] ?? false) !== true) {
            return $this->error('Confirm that the pet stayed and the Hotel Suite service was completed.', 422);
        }

        $reason = trim((string) ($validated['missed_checkin_reason'] ?? ''));
        if ($reason === '') {
            return $this->error('A reason for the missed check-in recording is required.', 422);
        }
        if (empty($validated['actual_check_in_at']) || empty($validated['actual_check_out_at'])) {
            return $this->error('Enter the actual check-in and check-out date and time.', 422);
        }
        foreach (['actual_check_in_at', 'actual_check_out_at'] as $timestampField) {
            if (!preg_match('/[T ]\d{2}:\d{2}/', (string) $validated[$timestampField])) {
                return $this->error('Enter valid actual check-in and check-out date and time values.', 422);
            }
        }

        $actualCheckIn = Carbon::parse($validated['actual_check_in_at'], 'Asia/Manila');
        $actualCheckOut = Carbon::parse($validated['actual_check_out_at'], 'Asia/Manila');
        $now = Carbon::now('Asia/Manila');
        if ($actualCheckIn->greaterThan($now)) {
            return $this->error('Actual check-in cannot be in the future.', 422);
        }
        if ($actualCheckOut->greaterThan($now)) {
            return $this->error('Actual check-out cannot be in the future.', 422);
        }
        if ($actualCheckOut->lessThanOrEqualTo($actualCheckIn)) {
            return $this->error('Actual check-out must be after the actual check-in.', 422);
        }

        $handledById = (string) ($validated['handled_by'] ?? '');
        if ($handledById === '') {
            return $this->error('Select the staff member who handled the Hotel Suite stay.', 422);
        }

        $error = DB::transaction(function () use ($appointment, $actualCheckIn, $actualCheckOut, $reason, $request, $handledById, $validated) {
            $locked = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            $locked->load(['service', 'hotelSuite', 'appointmentAddons']);
            $handledBy = User::query()
                ->whereKey($handledById)
                ->where('role', 'staff')
                ->whereIn('staff_type', [User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (
                $locked->status !== 'approved'
                || strtolower((string) ($locked->service?->category ?? '')) !== 'hotel'
                || $locked->actual_check_in_at
                || $locked->actual_check_out_at
            ) {
                return 'This appointment is no longer eligible for missed check-in completion.';
            }
            if (!$locked->hotel_suite_id || !$locked->hotel_nights || !$locked->hotelSuite) {
                return 'A Hotel Suite and stay duration are required before completing this appointment.';
            }
            if (!$handledBy) {
                return 'The selected Handled By staff member is unavailable. Select an active staff member.';
            }
            if (AuditLog::query()
                ->where('action', 'hotel_missed_checkin_completed')
                ->where('metadata->appointment_id', (string) $locked->id)
                ->exists()) {
                return 'A missed check-in completion history record already exists for this appointment.';
            }

            $hotelServiceTotal = $this->pricingService->resolveBasePriceFromServicePackage($locked)
                + (float) $locked->appointmentAddons()->sum('price_charged');
            $totalPrice = max((float) ($locked->total_price ?? 0), $hotelServiceTotal);
            if ((float) ($locked->deposit ?? 0) < round($totalPrice * 0.5, 2)) {
                return 'The Hotel Suite reservation must retain its required 50% deposit before completion.';
            }
            if (!in_array($locked->reservation_channel, ['cash', 'e_wallet', 'bank_transfer'], true)) {
                return 'The Hotel Suite reservation payment method is missing.';
            }
            if ($locked->reservation_channel !== 'cash'
                && (
                    !$locked->reservation_payment_account_id
                    || !$locked->reservation_payer_provider
                    || (!$locked->reference_number && !$locked->reservation_deposit_proof_url)
                )) {
                return 'The Hotel Suite reservation payment details are incomplete.';
            }

            $recordedAt = Carbon::now('Asia/Manila');
            $actor = $request->user();
            $actorId = (string) $actor?->id;
            $actorRole = $this->formatStaffRole($actor);
            $handledByRole = $this->formatStaffRole($handledBy);
            $locked->append(['scheduled_check_in_at', 'scheduled_check_out_at']);
            $scheduledCheckIn = $locked->scheduled_check_in_at?->copy()->timezone('Asia/Manila');
            $scheduledCheckOut = $locked->scheduled_check_out_at?->copy()->timezone('Asia/Manila');
            $preview = $this->hotelExtensionService->preview($locked, $actualCheckOut);
            $charge = $this->hotelExtensionService->record(
                $locked, $preview, $validated, $handledBy->id, $actor?->id
            );
            $correctionNote = sprintf(
                "Missed check-in correction reason: %s\nRecorded by staff user %s at %s",
                $reason,
                $actorId,
                $recordedAt->toIso8601String()
            );
            $existingNotes = trim((string) ($locked->late_checkin_staff_notes ?? ''));
            $locked->late_checkin_staff_notes = $existingNotes === ''
                ? $correctionNote
                : $existingNotes . "\n\n" . $correctionNote;
            $locked->total_price = $totalPrice;
            $locked->actual_check_in_at = $actualCheckIn;
            $locked->actual_check_out_at = $actualCheckOut;
            $locked->handled_by = $handledBy->id;

            $locked->status = 'in_progress';
            $locked->save();
            $locked->status = 'completed';
            $locked->completed_at = $recordedAt;
            $locked->save();
            if ($charge) {
                $this->logHotelExtensionPayment($request, $locked, $charge);
            }

            AuditLog::create([
                'user_id' => $actor?->id,
                'actor_name' => $actor?->name,
                'actor_email' => $actor?->email,
                'action' => 'hotel_missed_checkin_completed',
                'method' => 'PATCH',
                'route' => '/api/appointments/{appointment}/status',
                'status_code' => 200,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 1000) ?: null,
                'metadata' => [
                    'module' => 'Appointments',
                    'description' => 'Hotel Stay Completed — Missed Check-In Correction',
                    'appointment_id' => (string) $locked->id,
                    'appointment_code' => $locked->appointment_code,
                    'previous_status' => 'approved',
                    'new_status' => 'completed',
                    'scheduled_check_in_at' => $scheduledCheckIn?->toIso8601String(),
                    'scheduled_check_out_at' => $scheduledCheckOut?->toIso8601String(),
                    'actual_check_in_at' => $actualCheckIn->copy()->timezone('Asia/Manila')->toIso8601String(),
                    'actual_check_out_at' => $actualCheckOut->copy()->timezone('Asia/Manila')->toIso8601String(),
                    'correction_reason' => $reason,
                    'confirmed_stay_completed' => true,
                    'handled_by_id' => (string) $handledBy->id,
                    'handled_by_name' => $handledBy->name,
                    'handled_by_display_id' => $handledBy->display_id,
                    'handled_by_role' => $handledByRole,
                    'recorded_by_id' => (string) $actor?->id,
                    'recorded_by_name' => $actor?->name,
                    'recorded_by_role' => $actorRole,
                    'recorded_at' => $recordedAt->toIso8601String(),
                ],
                'created_at' => $recordedAt,
            ]);

            return null;
        });

        if ($error) {
            return $this->error($error, 422);
        }

        $appointment = Appointment::query()
            ->with(['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons'])
            ->findOrFail($appointment->id);
        \Log::info('Hotel stay completed after a missed check-in record was corrected.', [
            'appointment_id' => $appointment->id,
            'appointment_code' => $appointment->appointment_code,
            'actual_check_in_at' => $appointment->actual_check_in_at?->toIso8601String(),
            'actual_check_out_at' => $appointment->actual_check_out_at?->toIso8601String(),
            'correction_reason' => $reason,
            'updated_by' => $request->user()?->id,
        ]);
        $this->commissionService->earnForCompletedAppointment($appointment);

        $owner = $appointment->pet?->owner;
        if ($owner?->email) {
            try {
                Mail::to($owner->email)->send(new ThankYouMail($appointment, $owner, $appointment->pet));
            } catch (\Exception $e) {
                \Log::warning('Thank you email failed after missed Hotel check-in correction: ' . $e->getMessage());
            }
        }

        return $this->success($appointment, 'Hotel Suite appointment completed successfully.');
    }

    private function formatStaffRole(?User $user): string
    {
        if (!$user) {
            return 'Unknown';
        }
        if ($user->isAdmin()) {
            return 'Admin';
        }

        $staffKind = $user->staff_type ?: (strtolower((string) $user->role) === 'staff' ? null : $user->role);
        return $staffKind
            ? 'Staff (' . ucwords(str_replace('_', ' ', (string) $staffKind)) . ')'
            : 'Staff';
    }

    /**
     * Cancel an appointment (customer action).
     * PATCH /appointments/{appointment}/cancel
     */
    public function cancelOwn(Appointment $appointment, Request $request)
    {
        $owner = $request->user()->owner
            ?? \App\Models\Owner::where('email', $request->user()->email)->first();

        if (!$owner || $appointment->pet?->owner_id !== $owner->id) {
            return $this->error('Unauthorized.', 403);
        }

        if (!in_array($appointment->status, ['pending', 'approved'])) {
            return $this->error('Only pending or approved appointments can be cancelled.', 422);
        }

        if (!$this->canCancelBeforeService($appointment)) {
            return $this->error('Approved appointments can only be cancelled before the scheduled start time.', 422);
        }

        $appointment->update([
            'status'              => 'cancelled',
            'cancellation_reason' => $this->cancellationReasonWithTiming($appointment, $request->input('cancellation_reason')),
            'check_out_time'      => now('Asia/Manila'),
            'cancelled_at'        => now('Asia/Manila'),
            'cancelled_by'        => $request->user()?->id,
            'cancellation_type'   => 'customer_cancellation',
        ]);

        return $this->success(null, 'Appointment cancelled successfully.');
    }

    /**
     * Delete an appointment (admin only - handled by policy).
     * DELETE /appointments/{appointment}
     */

    private function success($data, string $message = '', int $status = 200): JsonResponse
    { return response()->json(['status' => $status, 'message' => $message, 'data' => $data], $status); }

    private function error(string $message, int $status = 400, array $errors = []): JsonResponse
    { return response()->json(['status' => $status, 'message' => $message, 'data' => $errors], $status); }

    private function authorize($ability, $arguments = []): void
    { Gate::authorize($ability, $arguments); }
    protected function appointmentDateTime(Appointment $appointment): ?\Carbon\Carbon
    {
        if (!$appointment->appointment_date || !$appointment->start_time) {
            return null;
        }

        $date = $appointment->appointment_date instanceof \Carbon\Carbon
            ? $appointment->appointment_date->format('Y-m-d')
            : \Carbon\Carbon::parse($appointment->appointment_date)->format('Y-m-d');

        return \Carbon\Carbon::parse($date . ' ' . $appointment->start_time, 'Asia/Manila');
    }

    protected function isLateCancellation(Appointment $appointment): bool
    {
        $appointmentDateTime = $this->appointmentDateTime($appointment);

        return $appointmentDateTime
            ? now('Asia/Manila')->greaterThan($appointmentDateTime->copy()->subHours(24))
            : false;
    }
    protected function cancellationReasonWithTiming(Appointment $appointment, ?string $reason): ?string
    {
        $reason = trim((string) $reason);

        if (!$this->isLateCancellation($appointment)) {
            return $reason !== '' ? $reason : null;
        }

        if (str_starts_with($reason, '[LATE CANCELLATION]')) {
            return $reason;
        }

        return trim('[LATE CANCELLATION] ' . $reason);
    }
    protected function cancellationTypeFor(Appointment $appointment): string
    {
        return $this->isLateCancellation($appointment) ? 'late' : 'normal';
    }
    protected function canCancelBeforeService(Appointment $appointment): bool
    {
        if ($appointment->status === 'pending') {
            return true;
        }

        $appointmentDateTime = $this->appointmentDateTime($appointment);

        return $appointmentDateTime
            ? now('Asia/Manila')->lessThan($appointmentDateTime)
            : true;
    }
    protected function canMarkNoShow(Appointment $appointment): bool
    {
        $appointmentDateTime = $this->appointmentDateTime($appointment);

        return $appointmentDateTime
            ? now('Asia/Manila')->greaterThanOrEqualTo($appointmentDateTime->copy()->addMinutes(15))
            : false;
    }
    protected function applyActiveHotelReservationFilter($query)
    {
        $now = now('Asia/Manila');

        return $query
            ->whereNotIn('status', ['cancelled', 'completed', 'no_show', 'rejected'])
            ->where(function ($q) use ($now) {
                $q->where('status', '!=', 'pending')
                    ->orWhereNull('capacity_hold_expires_at')
                    ->orWhere('capacity_hold_expires_at', '>', $now);
            });
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
