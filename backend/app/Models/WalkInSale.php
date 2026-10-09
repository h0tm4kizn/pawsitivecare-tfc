<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WalkInSale extends Model
{
    use HasUuids;

    protected $fillable = [
        'receipt_number',
        'appointment_id',
        'customer_name',
        'total_amount',
        'payment_method',
        'payment_channel',
        'payment_received_by',
        'reference_number',
        'notes',
        'sold_by',
        'sold_at',
        'voided_at',
        'voided_by',
    ];

    protected $casts = [
        'total_amount' => 'float',
        'sold_at'      => 'datetime',
        'voided_at'    => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(WalkInSaleItem::class, 'walk_in_sale_id');
    }

    public function soldBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function supply()
    {
        return $this->hasOne(Supply::class, 'walk_in_sale_id');
    }
}
