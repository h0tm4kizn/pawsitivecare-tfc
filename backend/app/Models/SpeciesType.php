<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SpeciesType is our reference table for species options (Dog, Cat, etc.).
 * We use this model to keep species values consistent in our forms and DB.
 */
class SpeciesType extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'name',
        'code',
        'is_active',
    ];

    // One species can have many breeds in our cascading dropdown flow.
    public function breeds(): HasMany
    {
        return $this->hasMany(Breed::class, 'species_id');
    }

    // One species can be linked to many pets in our records.
    public function pets(): HasMany
    {
        return $this->hasMany(Pet::class, 'species_id');
    }
}
