<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalkInSaleItem extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'walk_in_sale_id',
        'inventory_id',
        'promotion_id',
        'promotion_title_snapshot',
        'promotion_type_snapshot',
        'promotion_value_snapshot',
        'original_unit_price',
        'discount_amount',
        'final_unit_price',
        'item_snapshot_id',
        'item_snapshot_name',
        'cost_price_snapshot',
        'quantity',
        'selling_price',
        'subtotal',
    ];

    protected $casts = [
        'cost_price_snapshot' => 'float',
        'quantity'            => 'integer',
        'selling_price'       => 'float',
        'subtotal'            => 'float',
        'promotion_value_snapshot' => 'float',
        'original_unit_price' => 'float',
        'discount_amount' => 'float',
        'final_unit_price' => 'float',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(WalkInSale::class, 'walk_in_sale_id');
    }

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class, 'promotion_id');
    }
}
