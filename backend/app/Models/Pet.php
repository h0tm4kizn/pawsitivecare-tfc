<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Pet is our core animal profile record.
 * This model stores identity fields, biometric data, and links to owner/species/breed.
 */
class Pet extends Model
{
    use HasUuids, SoftDeletes;

    // pets table has only created_at — no updated_at column
    const UPDATED_AT = null;

    protected $fillable = [
        'pet_id',
        'owner_id',
        'species_id',
        'breed_id',
        'name',
        'sex',
        'date_of_birth',
        'weight_kg',
        'identification_hash',
        'identification_image_url',
        'recognition_registered',
        'recognition_registered_at',
        'nose_print_hash',
        'nose_print_image_url',
        'medical_notes',
        'photo_url',
        'is_active',
        'deactivation_reason',
        'deletion_reason',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'weight_kg' => 'decimal:2',
        'is_active' => 'boolean',
        'recognition_registered' => 'boolean',
        'recognition_registered_at' => 'datetime',
    ];

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d');
    }

    // Computed accessor — Age is never stored in DB, always derived from date_of_birth.
    // Frontend displays this value; do NOT add an 'age' column to the pets table.
    public function getAgeAttribute(): ?int
    {
        if (!$this->date_of_birth) {
            return null;
        }
        return Carbon::parse($this->date_of_birth)->age;
    }

    public function getPetIdAttribute($value): ?string
    {
        return $value;
    }

    // Each pet belongs to one owner profile.
    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class, 'owner_id');
    }

    // Each pet belongs to one species reference row.
    public function speciesType(): BelongsTo
    {
        return $this->belongsTo(SpeciesType::class, 'species_id');
    }

    // Each pet belongs to one breed reference row.
    public function breed(): BelongsTo
    {
        return $this->belongsTo(Breed::class, 'breed_id');
    }

    // Pet assessment history submitted by the owner.
    public function healthForms(): HasMany
    {
        return $this->hasMany(PetHealthForm::class, 'pet_id');
    }

    // Latest pet assessment used by current booking checks.
    public function healthForm(): HasOne
    {
        return $this->hasOne(PetHealthForm::class, 'pet_id')->latestOfMany('created_at');
    }

    public function recognitionPhotos(): HasMany
    {
        return $this->hasMany(RecognitionPhoto::class)->latest('captured_at');
    }
}
