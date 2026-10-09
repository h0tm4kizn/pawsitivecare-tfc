<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class HotelExtensionCharge extends Model
{
    use HasUuids;

    protected $fillable = [
        'appointment_id', 'pet_species', 'pet_size', 'daycare_service_id',
        'daycare_tier_id', 'daycare_tier_label', 'hourly_rate',
        'scheduled_checkout_at', 'actual_checkout_at', 'extra_minutes',
        'billable_hours', 'amount', 'payment_amount', 'payment_method',
        'payment_status', 'payment_reference', 'handled_by', 'recorded_by', 'recorded_at',
    ];

    protected $casts = [
        'scheduled_checkout_at' => 'datetime',
        'actual_checkout_at' => 'datetime',
        'recorded_at' => 'datetime',
        'hourly_rate' => 'decimal:2',
        'amount' => 'decimal:2',
        'payment_amount' => 'decimal:2',
    ];

    protected $appends = ['handled_by_name', 'recorded_by_name'];

    public function getHandledByNameAttribute(): ?string
    {
        return $this->handledBy?->name;
    }

    public function getRecordedByNameAttribute(): ?string
    {
        return $this->recordedBy?->name;
    }

    public function handledBy()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function appointment()
    {
        return $this->belongsTo(Appointment::class, 'appointment_id')->withTrashed();
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
