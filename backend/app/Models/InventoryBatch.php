<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryBatch extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id',
        'batch_code',
        'quantity_available',
        'expiration_date',
        'date_received',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'quantity_available' => 'integer',
        'expiration_date' => 'date',
        'date_received' => 'date',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Inventory::class, 'product_id');
    }

    public function supplyItems(): HasMany
    {
        return $this->hasMany(SupplyItem::class, 'batch_id');
    }
}
