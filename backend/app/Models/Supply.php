<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supply extends Model
{
    use HasUuids;

    protected $fillable = [
        'walk_in_sale_id',
        'appointment_id',
        'total_amount',
        'created_by',
    ];

    protected $casts = [
        'total_amount' => 'float',
    ];

    public function supplyItems(): HasMany
    {
        return $this->hasMany(SupplyItem::class, 'supply_id');
    }

    public function walkInSale(): BelongsTo
    {
        return $this->belongsTo(WalkInSale::class, 'walk_in_sale_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
