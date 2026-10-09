<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Promotion extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'description', 'discount_type', 'discount_value',
        'promotional_price', 'starts_on', 'ends_on', 'is_active',
        'applies_to_all_services', 'applies_to_all_inventory',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'promotional_price' => 'decimal:2',
        'starts_on' => 'date:Y-m-d',
        'ends_on' => 'date:Y-m-d',
        'is_active' => 'boolean',
        'applies_to_all_services' => 'boolean',
        'applies_to_all_inventory' => 'boolean',
    ];

    public function serviceTiers(): BelongsToMany
    {
        return $this->belongsToMany(ServiceTier::class, 'promotion_service_tier', 'promotion_id', 'service_tier_id');
    }

    public function walkInSaleItems()
    {
        return $this->hasMany(WalkInSaleItem::class, 'promotion_id');
    }

    public function inventoryItems(): BelongsToMany
    {
        return $this->belongsToMany(Inventory::class, 'promotion_inventory', 'promotion_id', 'inventory_id');
    }

    public function scopeAvailableOn($query, $date = null)
    {
        $date = $date ?: now()->toDateString();
        return $query->where('is_active', true)
            ->whereDate('starts_on', '<=', $date)
            ->whereDate('ends_on', '>=', $date);
    }

    public function priceFor(float $basePrice): float
    {
        return match ($this->discount_type) {
            'percentage' => max(0, $basePrice - ($basePrice * ((float) $this->discount_value / 100))),
            'fixed' => max(0, $basePrice - (float) $this->discount_value),
            'promotional_price' => min($basePrice, (float) $this->promotional_price),
            default => $basePrice,
        };
    }

    public function savingsFor(float $basePrice): float
    {
        return max(0, $basePrice - $this->priceFor($basePrice));
    }
}
