<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentAddon extends Model
{
    use HasUuids;

    // Junction table — no timestamps in migration
    public $timestamps = false;

    protected $fillable = [
        'appointment_id',
        'addon_id',         // FK column name per migration: addon_id → service_addons
        'price_charged',    // per migration: price_charged (not 'price')
        'notes',
    ];

    protected $casts = [
        'price_charged' => 'decimal:2',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    // FK in this table is 'addon_id', pointing to service_addons
    public function serviceAddon(): BelongsTo
    {
        return $this->belongsTo(ServiceAddon::class, 'addon_id');
    }
}
