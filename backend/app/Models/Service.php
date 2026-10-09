<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'display_id',
        'name',
        'category',
        'description',
        'is_active',
        'needs_cage',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'needs_cage' => 'boolean',
    ];

    // One service has many size-based pricing tiers
    public function serviceTiers(): HasMany
    {
        return $this->hasMany(ServiceTier::class, 'service_id')->orderByRaw("
            CASE UPPER(size_label)
                WHEN 'S'      THEN 1
                WHEN 'M'      THEN 2
                WHEN 'L'      THEN 3
                WHEN 'XL'     THEN 4
                WHEN 'XXL'    THEN 5
                WHEN 'GIANT'  THEN 6
                WHEN 'KITTEN' THEN 7
                WHEN 'CAT'    THEN 8
                ELSE 9
            END
        ");
    }

    // One service can be booked in many appointments
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'service_id');
    }


}
