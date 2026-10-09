<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HotelSuite extends Model
{
    use HasUuids;

    public const DISPLAY_ORDER = [
        'The Cozy Paw Suite',
        'The Happy Paws Suite',
        'The Grand Paw Suite',
        'The VIPaws Suite',
        'The Cozy Whiskers',
        'The Grand Purr Suite',
        'The VIPurr Villa',
    ];

    // Migration has timestamps() — allow Laravel to manage created_at / updated_at
    public $timestamps = true;

    protected $fillable = [
        'name',
        'species_type',
        'size_range',
        'price_per_night',
        'capacity',
        'is_available',
        'description',
    ];

    protected $casts = [
        'price_per_night' => 'decimal:2',
        'capacity'        => 'integer',
        'is_available'    => 'boolean',
    ];

    public function scopeOrderedForDisplay($query)
    {
        $cases = [];

        foreach (self::DISPLAY_ORDER as $index => $suiteName) {
            $safeName = str_replace("'", "''", $suiteName);
            $cases[] = "WHEN '{$safeName}' THEN {$index}";
        }

        return $query
            ->orderByRaw('CASE name ' . implode(' ', $cases) . ' ELSE 999 END')
            ->orderBy('name');
    }

    // One hotel suite can be used in many appointments
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'hotel_suite_id');
    }
}
