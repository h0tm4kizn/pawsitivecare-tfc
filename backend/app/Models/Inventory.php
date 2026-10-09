<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Inventory extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'inventory';

    protected $fillable = [
        'item_id',
        'item_name',
        'item_type',
        'category',
        'barcode',
        'cost_price',
        'selling_price',
        'stock_quantity',
        'image_url',
        'is_active',
        'description',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'cost_price' => 'float',
        'selling_price' => 'float',
        'stock_quantity' => 'integer',
        'is_active' => 'boolean',
    ];

    public function billingLedgerLines(): HasMany
    {
        return $this->hasMany(BillingLedger::class, 'inventory_id');
    }

    public function serviceMaterials(): HasMany
    {
        return $this->hasMany(ServiceMaterial::class, 'inventory_id');
    }

    public function walkInSaleItems(): HasMany
    {
        return $this->hasMany(WalkInSaleItem::class, 'inventory_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(InventoryBatch::class, 'product_id');
    }

    public function supplyItems(): HasMany
    {
        return $this->hasMany(SupplyItem::class, 'product_id');
    }

    public function promotions(): BelongsToMany
    {
        return $this->belongsToMany(Promotion::class, 'promotion_inventory', 'inventory_id', 'promotion_id');
    }
}
