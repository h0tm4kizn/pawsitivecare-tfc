<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceAddon extends Model
{
    use HasUuids;

    // Reference table — no timestamps in migration
    public $timestamps = false;

    protected $fillable = [
        'display_id',
        'name',
        'category',
        'addon_group',
        'tier_label',
        'price_min',
        'price_max',
        'has_size_pricing',
        'applies_to_grooming',
        'applies_to_daycare',
        'applies_to_hotel',
        'is_active',
        'deactivation_reason',
    ];

    protected $casts = [
        'price_min'       => 'decimal:2',
        'price_max'       => 'decimal:2',
        'has_size_pricing' => 'boolean',
        'applies_to_grooming' => 'boolean',
        'applies_to_daycare'  => 'boolean',
        'applies_to_hotel'    => 'boolean',
        'is_active'       => 'boolean',
    ];

    // One service addon can appear in many appointment addon records
    // FK in appointment_addons is 'addon_id' (per migration)
    public function appointmentAddons(): HasMany
    {
        return $this->hasMany(AppointmentAddon::class, 'addon_id');
    }

}
