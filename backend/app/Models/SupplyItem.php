<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplyItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'supply_id',
        'product_id',
        'batch_id',
        'product_name',
        'quantity_used',
        'unit_price',
        'line_total',
        'expiration_date',
        'batch_quantity_used',
    ];

    protected $casts = [
        'quantity_used' => 'integer',
        'unit_price' => 'float',
        'line_total' => 'float',
        'expiration_date' => 'date',
        'batch_quantity_used' => 'integer',
    ];

    public function supply(): BelongsTo
    {
        return $this->belongsTo(Supply::class, 'supply_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Inventory::class, 'product_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }
}
