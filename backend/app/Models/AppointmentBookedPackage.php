<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentBookedPackage extends Model
{
    protected $fillable = [
        'booked_package_id',
        'appointment_id',
        'service_id',
        'package_id',
        'service_type',
        'package_name',
        'sequence_order',
        'status',
        'price',
    ];

    protected $casts = [
        'price' => 'float',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }
}

