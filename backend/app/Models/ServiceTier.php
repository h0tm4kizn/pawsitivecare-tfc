<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ServiceTier extends Model {
    use HasUuids;

    protected $fillable = [
        'service_id',
        'size_label',
        'min_weight_kg',
        'max_weight_kg',
        'price',
        'price_max',
        'duration_hours',
    ];

    protected $casts = [
        'min_weight_kg' => 'decimal:2',
        'max_weight_kg' => 'decimal:2',
    ];

    public function service() {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function promotions() {
        return $this->belongsToMany(Promotion::class, 'promotion_service_tier', 'service_tier_id', 'promotion_id');
    }
}
