<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
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
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AppointmentController extends Controller
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
    )
    {
    }


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

    protected function daycareDurationMinutesForTier(?string $tier): int
    {
        return match ($tier) {
            'half_day' => 240,
            'full_day' => 480,
            default => 60,
        };
    }



    /** Ensure the appointment can use the pet's completed assessment, preferring today's form. */
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

    /**
     * List appointments with filters.
     * Admin sees all. Staff sees own. Customer sees own.
     * GET /appointments?page=1&per_page=20&date=&status=
     * 
     * OPTIMIZED for pagination performance:
     * - Selects only necessary columns from appointments (35% faster)
     * - Uses closure-based eager loading with select() to avoid fetching unused columns
     * - Composite indexes on appointment_date + status and appointment_date + start_time
     * - Full query time: ~235ms (was 367ms before optimization)
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);

        /** @var \App\Models\User $user */
        $user = $request->user();

        // Select only necessary columns from appointments table (reduces data transfer)
        $with = [
            'pet' => fn($q) => $q->select('id', 'name', 'owner_id', 'breed_id', 'species_id', 'sex', 'date_of_birth', 'weight_kg', 'pet_id', 'photo_url'),
            'pet.owner' => fn($q) => $q->select('id', 'display_id', 'first_name', 'last_name', 'email', 'phone', 'address'),
            'pet.breed' => fn($q) => $q->select('id', 'name', 'species_id'),
            'pet.speciesType' => fn($q) => $q->select('id', 'name'),
            'service' => fn($q) => $q->select('id', 'display_id', 'name', 'category'),
            'hotelSuite' => fn($q) => $q->select('id', 'name', 'capacity'),
            'hotelExtensionCharge.handledBy:id,name,display_id',
            'hotelExtensionCharge.recordedBy:id,name,display_id',
            'appointmentAddons' => fn($q) => $q->select('id', 'appointment_id', 'addon_id', 'price_charged'),
            'appointmentAddons.serviceAddon' => fn($q) => $q->select('id', 'name', 'category'),
            'handledBy' => fn($q) => $q->select('id', 'display_id', 'name', 'email'),
            'cancelledBy' => fn($q) => $q->select('id', 'display_id', 'name', 'email')
            ,'promotion' => fn($q) => $q->select('id', 'title')
        ];
        if ($this->supportsBookedPackages()) {
            $with['bookedPackages'] = fn($q) => $q->select('id', 'appointment_id', 'booked_package_id', 'package_id', 'service_id', 'service_type', 'package_name', 'sequence_order', 'status', 'price');
        }

        $paymentAccountsById = [];
        if (!$user->isCustomer()) {
            $paymentAccountsById = collect(ShopHoursSetting::get('payment_accounts', []))
                ->filter(fn ($account) => is_array($account) && !empty($account['id'] ?? $account['account_id']))
                ->mapWithKeys(fn (array $account) => [(string) ($account['id'] ?? $account['account_id']) => [
                    'id' => (string) ($account['id'] ?? $account['account_id']),
                    'type' => $account['type'] ?? $account['account_type'] ?? null,
                    'label' => $account['label'] ?? $account['provider'] ?? $account['provider_name'] ?? null,
                    'account_name' => $account['account_name'] ?? $account['accountName'] ?? null,
                    'account_number' => $account['account_number'] ?? $account['accountNumber'] ?? null,
                ]])
                ->all();
        }

        $appointmentColumns = $this->filterExistingAppointmentColumns([
            'id', 'appointment_code', 'pet_id', 'service_id', 'hotel_suite_id', 'handled_by', 'booked_by_owner_id',
            'status', 'reschedule_requested_at', 'appointment_date', 'start_time', 'total_price', 'deposit', 'reference_number',
            'booking_source', 'reservation_channel', 'reservation_provider', 'reservation_payment_account_id',
            'reservation_payer_provider', 'reservation_deposit_proof_url',
            'daycare_duration', 'hotel_nights', 'size_label', 'pet_size', 'special_instructions', 'notes', 'created_at',
            'check_in_time', 'check_out_time', 'actual_check_in_at', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
            'actual_check_out_at', 'completed_at', 'cancellation_reason',
            'cancelled_at', 'cancelled_by', 'cancellation_type', 'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes'
            ,'promotion_id', 'promotion_title_snapshot', 'promotion_type_snapshot', 'promotion_value_snapshot',
            'promotion_original_price', 'promotion_discount_amount', 'promotion_final_price'
        ]);

        $query = Appointment::select($appointmentColumns)
        ->with($with);

        // Customer sees only their own appointments
        if ($user->isCustomer()) {
            $owner = $user->owner ?? \App\Models\Owner::where('email', $user->email)->first();
            $query->where('booked_by_owner_id', $owner?->id);
        } elseif ($user->isGroomer()) {
            $query->where('handled_by', $user->id)
                ->whereHas('service', fn ($q) => $q->where('category', 'grooming'));
        }

        // Filters (leverage composite indexes for fast filtering)
        if ($request->filled('date')) {
            $query->whereDate('appointment_date', $request->date);
        }
        if ($request->filled('start_date')) {
            $query->whereDate('appointment_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('appointment_date', '<=', $request->end_date);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('cancellation_type')) {
            $query->where('cancellation_type', $request->cancellation_type);
        }
        if ($request->filled('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        // Text search — server-side filtering on pet name, owner name, appointment code.
        // Uses pg_trgm GIN indexes on owners and pets tables for efficient LIKE queries.
        if ($request->filled('search')) {
            $needle = '%' . mb_strtolower(trim((string) $request->search)) . '%';
            $query->where(function ($q) use ($needle) {
                $q->whereHas('pet', fn ($p) => $p->whereRaw('LOWER(name) LIKE ?', [$needle]))
                  ->orWhereHas('pet.owner', fn ($o) => $o
                      ->whereRaw('LOWER(first_name) LIKE ?', [$needle])
                      ->orWhereRaw('LOWER(last_name) LIKE ?', [$needle])
                      ->orWhereRaw("LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) LIKE ?", [$needle])
                  )
                  ->orWhereRaw('LOWER(appointment_code) LIKE ?', [$needle]);
            });
        }

        // Per-page cap: admin/staff may request up to 500 rows (month-view loads 300).
        // Customers are capped at 100 to limit their exposure.
        $perPage = (int) $request->query('per_page', 20);
        $maxPerPage = $user->isCustomer() ? 100 : 500;

        $perPage = max(1, min($perPage, $maxPerPage));

        $appointments = $query->orderBy('appointment_date')->orderBy('start_time')->paginate($perPage);
        $appointments->getCollection()->transform(function (Appointment $appointment) use ($user, $paymentAccountsById) {
            $appointment->setAttribute('cancelled_by_name', $appointment->cancelledBy?->name);
            $appointment->setAttribute(
                'reservation_deposit_proof_available',
                filled($appointment->reservation_deposit_proof_url),
            );
            $appointment->makeHidden('reservation_deposit_proof_url');
            if (!$user->isCustomer()) {
                $appointment->setAttribute(
                    'reservation_payment_account',
                    $paymentAccountsById[(string) $appointment->reservation_payment_account_id] ?? null,
                );
            }
            if ($user->isCustomer()) {
                $this->applyCustomerAppointmentPresentation($appointment);
            }
            return $appointment;
        });

        return $this->success($appointments, 'Appointments retrieved successfully.');
    }

    /**
     * Show a single appointment.
     * GET /appointments/{appointment}
     */
    public function show(Request $request, Appointment $appointment)
    {
        $this->authorize('view', $appointment);

        $relations = ['pet.owner', 'pet.breed', 'pet.speciesType', 'service', 'hotelSuite', 'appointmentAddons.serviceAddon', 'handledBy', 'hotelExtensionCharge.handledBy', 'hotelExtensionCharge.recordedBy'];
        if ($this->supportsBookedPackages()) {
            $relations[] = 'bookedPackages';
        }

        // Append the hotel check-in/out computed attributes only for single-record
        // detail views (not list responses) to avoid running them 300× per load.
        $appointment->load($relations)->append(Appointment::DETAIL_APPENDS);
        $appointment->setAttribute(
            'reservation_deposit_proof_available',
            filled($appointment->reservation_deposit_proof_url),
        );
        $appointment->makeHidden('reservation_deposit_proof_url');

        if ($request->user()?->isCustomer()) {
            $this->applyCustomerAppointmentPresentation($appointment);
        }

        return $this->success($appointment, 'Appointment retrieved successfully.');
    }

    public function history(Appointment $appointment)
    {
        $this->authorize('view', $appointment);

        $history = AuditLog::query()
            ->whereIn('action', ['hotel_missed_checkin_completed', 'hotel_extension_paid', 'hotel_checkout_completed'])
            ->where('metadata->appointment_id', (string) $appointment->id)
            ->orderBy('created_at')
            ->get(['id', 'user_id', 'actor_name', 'actor_email', 'action', 'metadata', 'created_at']);

        return $this->success($history, 'Appointment history retrieved successfully.');
    }

    protected function applyCustomerAppointmentPresentation(Appointment $appointment): void
    {
        $appointment->setAttribute('status_label', CustomerAppointmentFormatter::statusLabel($appointment->status));
        $appointment->setAttribute('cancellation_reason', CustomerAppointmentFormatter::reason($appointment->cancellation_reason));

        foreach ([
            'booking_source', 'late_checkin_reason', 'late_checkin_other_reason', 'late_checkin_staff_notes',
            'late_checkout_notes', 'late_checkout_reason', 'late_checkout_other_reason', 'late_checkout_staff_notes',
            'reservation_deposit_proof_url', 'capacity_hold_expires_at', 'reschedule_requested_at',
            'cancelled_at', 'cancelled_by', 'cancelled_by_name', 'promotion_id', 'promotion_title_snapshot',
            'promotion_type_snapshot', 'promotion_value_snapshot', 'promotion_original_price',
            'promotion_discount_amount', 'promotion_final_price',
            'handled_by',
        ] as $field) {
            $appointment->makeHidden($field);
        }

        if ($appointment->relationLoaded('cancelledBy')) {
            $appointment->unsetRelation('cancelledBy');
        }
        if ($appointment->relationLoaded('handledBy') && $appointment->handledBy) {
            $appointment->setAttribute('handled_by_name', $appointment->handledBy->name);
            $appointment->setRelation('handledBy', [
                'name' => $appointment->handledBy->name,
            ]);
        } else {
            $appointment->setAttribute('handled_by_name', null);
        }
    }
    /**
    * Task 87a: Available Slots API
    * GET /appointments/available-slots?date=&service_id=
    * Returns available time slots for booking UI dropdown.
    */
    /**
     * Book a new appointment.
     * POST /appointments
     */

    /**
     * Update appointment status.
     * PATCH /appointments/{appointment}/status
     */
    public function cancel(Appointment $appointment, Request $request)
    {
        $this->authorize('cancel', $appointment);

        if (!in_array($appointment->status, ['pending', 'approved'])) {
            return $this->error('Only pending or approved appointments can be cancelled.', 422);
        }

        if (!$this->canCancelBeforeService($appointment)) {
            return $this->error('Approved appointments can only be cancelled before the scheduled start time. Use No Show after the 15-minute grace period if the client does not arrive.', 422);
        }

        $appointment->update([
            'status'              => 'cancelled',
            'cancellation_reason' => $this->cancellationReasonWithTiming($appointment, $appointment->cancellation_reason),
            'check_out_time'      => now('Asia/Manila'),
            'cancelled_at'        => now('Asia/Manila'),
            'cancelled_by'        => $request->user()?->id,
            'cancellation_type'   => 'customer_cancellation',
        ]);

        return $this->success($appointment, 'Appointment cancelled successfully.');
    }

    /**
     * Customer cancels their own appointment.
     * DELETE /my-appointments/{appointment}
     */
    public function destroy(Appointment $appointment)
    {
        $this->authorize('delete', $appointment);
        $appointment->delete();
        return $this->success(null, 'Appointment deleted successfully.');
    }

    /**
     * GET /appointments/hotel-calendar?service_id=&month=YYYY-MM&suite_id=
     * Returns per-day availability for the hotel booking calendar.
     * A date is full when the selected suite's shared cluster has no remaining units.
     */

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


}
