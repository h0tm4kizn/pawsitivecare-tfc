<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Breed is our normalized list of breeds.
 * We attach each breed to a species so our UI can filter breed options correctly.
 */
class Breed extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'species_id',
        'name',
        'is_active',
    ];

    // Each breed belongs to one species type.
    public function speciesType(): BelongsTo
    {
        return $this->belongsTo(SpeciesType::class, 'species_id');
    }

    // One breed can be used by many pet profiles.
    public function pets(): HasMany
    {
        return $this->hasMany(Pet::class, 'breed_id');
    }
}
