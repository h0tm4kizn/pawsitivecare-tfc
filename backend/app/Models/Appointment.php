<?php

namespace App\Models;

use App\Models\StaffCommission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Appointment extends Model
{
    use HasUuids, SoftDeletes;

    protected static function booted(): void
    {
        static::saving(function (Appointment $appointment): void {
            if ($appointment->status === 'completed' && !$appointment->completed_at) {
                $appointment->completed_at = now('Asia/Manila');
            }
        });
    }

    protected $fillable = [
        'appointment_code',
        'pet_id',
        'service_id',
        'promotion_id',
        'promotion_title_snapshot',
        'promotion_type_snapshot',
        'promotion_value_snapshot',
        'promotion_original_price',
        'promotion_discount_amount',
        'promotion_final_price',
        'hotel_suite_id',
        'handled_by',
        'booked_by_owner_id',
        'size_label',
        'pet_size',
        'status',
        'appointment_date',
        'start_time',
        'check_in_time',
        'check_out_time',
        'actual_check_in_at',
        'late_checkin_reason',
        'late_checkin_other_reason',
        'late_checkin_staff_notes',
        'actual_check_out_at',
        'late_checkout_notes',
        'late_checkout_reason',
        'late_checkout_other_reason',
        'late_checkout_staff_notes',
        'completed_at',
        'cancelled_at',
        'cancelled_by',
        'cancellation_type',
        'special_instructions',
        'daycare_duration',
        'hotel_nights',
        'is_full_day_package',
        'grooming_discount',
        'total_price',
        'deposit',
        'reference_number',
        'booking_source',
        'reservation_channel',
        'reservation_provider',
        'reservation_payment_account_id',
        'reservation_payer_provider',
        'capacity_hold_expires_at',
        'reschedule_requested_at',
        'reservation_deposit_proof_url',
        'notes',
        'cancellation_reason',
    ];

    protected $casts = [
        'appointment_date' => 'date:Y-m-d',
        'check_in_time'    => 'datetime',
        'check_out_time'   => 'datetime',
        'actual_check_in_at' => 'datetime',
        'actual_check_out_at' => 'datetime',
        'completed_at'     => 'datetime',
        'cancelled_at'     => 'datetime',
        'is_full_day_package' => 'boolean',
        'grooming_discount' => 'float',
        'deposit'          => 'float',
        'total_price'      => 'float',
        'promotion_value_snapshot' => 'float',
        'promotion_original_price' => 'float',
        'promotion_discount_amount' => 'float',
        'promotion_final_price' => 'float',
        'capacity_hold_expires_at' => 'datetime',
        'reschedule_requested_at' => 'datetime',
    ];

    /**
     * These computed attributes are NOT auto-appended on list responses for performance.
     * Call $appointment->append(self::DETAIL_APPENDS) explicitly in show() / update()
     * where the single-record detail view needs them.
     */
    public const DETAIL_APPENDS = [
        'scheduled_check_in_at',
        'late_checkin_indicator',
        'checkin_time_difference_minutes',
        'scheduled_check_out_at',
        'late_checkout_indicator',
        'checkout_time_difference_minutes',
    ];

    public function getScheduledCheckInAtAttribute(): ?\Illuminate\Support\Carbon
    {
        return $this->scheduledHotelCheckinAt();
    }

    public function getLateCheckinIndicatorAttribute(): bool
    {
        return ($this->checkin_time_difference_minutes ?? 0) > 0;
    }

    public function getCheckinTimeDifferenceMinutesAttribute(): ?int
    {
        $scheduled = $this->scheduledHotelCheckinAt();
        $actual = $this->actual_check_in_at;

        if (!$scheduled || !$actual) {
            return null;
        }

        return $scheduled->diffInMinutes($actual, false);
    }

    public function getScheduledCheckOutAtAttribute(): ?\Illuminate\Support\Carbon
    {
        return $this->scheduledHotelCheckoutAt();
    }

    public function getLateCheckoutIndicatorAttribute(): bool
    {
        return ($this->checkout_time_difference_minutes ?? 0) > 0;
    }

    public function getCheckoutTimeDifferenceMinutesAttribute(): ?int
    {
        $scheduled = $this->scheduledHotelCheckoutAt();
        $actual = $this->actual_check_out_at;

        if (!$scheduled || !$actual) {
            return null;
        }

        return $scheduled->diffInMinutes($actual, false);
    }

    private function scheduledHotelCheckoutAt(): ?\Illuminate\Support\Carbon
    {
        $category = strtolower((string) ($this->service?->category ?? ''));
        if ($category !== 'hotel') {
            return null;
        }

        if (!$this->appointment_date) {
            return null;
        }

        $nights = max(1, (int) ($this->hotel_nights ?? 1));
        $startTime = (string) ($this->start_time ?? '09:00:00');
        if ($startTime === '' || $startTime === '00:00:00') {
            $startTime = '09:00:00';
        }

        return \Illuminate\Support\Carbon::parse($this->appointment_date, 'Asia/Manila')
            ->addDays($nights)
            ->setTimeFromTimeString($startTime);
    }

    private function scheduledHotelCheckinAt(): ?\Illuminate\Support\Carbon
    {
        $category = strtolower((string) ($this->service?->category ?? ''));
        if ($category !== 'hotel') {
            return null;
        }

        if (!$this->appointment_date) {
            return null;
        }

        $startTime = (string) ($this->start_time ?? '09:00:00');
        if ($startTime === '' || $startTime === '00:00:00') {
            $startTime = '09:00:00';
        }

        return \Illuminate\Support\Carbon::parse($this->appointment_date, 'Asia/Manila')
            ->setTimeFromTimeString($startTime);
    }

    // Pet being served
    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class, 'pet_id');
    }

    // Service package booked
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class, 'promotion_id');
    }

    // Hotel suite — nullable, only for hotel bookings
    public function hotelSuite(): BelongsTo
    {
        return $this->belongsTo(HotelSuite::class, 'hotel_suite_id');
    }

    public function hotelExtensionCharge()
    {
        return $this->hasOne(HotelExtensionCharge::class, 'appointment_id');
    }

    // Staff member handling this appointment
    public function handledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    // Owner who made the booking
    public function bookedByOwner(): BelongsTo
    {
        return $this->belongsTo(Owner::class, 'booked_by_owner_id');
    }

    // Add-ons attached to this appointment
    public function appointmentAddons(): HasMany
    {
        return $this->hasMany(AppointmentAddon::class, 'appointment_id');
    }

    public function walkInSales(): HasMany
    {
        return $this->hasMany(WalkInSale::class, 'appointment_id');
    }

    public function staffCommissions(): HasMany
    {
        return $this->hasMany(StaffCommission::class, 'appointment_id');
    }

    // Ledger lines (service and adjustments) tied to this appointment
    // Package instances booked under this appointment transaction
    public function bookedPackages(): HasMany
    {
        return $this->hasMany(AppointmentBookedPackage::class, 'appointment_id')
            ->orderBy('sequence_order');
    }
}
