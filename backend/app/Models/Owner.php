<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Owner is our customer profile record.
 * We keep this separate from users so our login account data and client profile data stay organized.
 */
class Owner extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'display_id',
        'user_id',
        'first_name',
        'last_name',
        'ec_first_name',
        'ec_last_name',
        'ec_email',
        'ec_phone',
        'ec_relationship',
        'email',
        'phone',
        'address',
        'address_unit_floor',
        'address_street',
        'address_barangay',
        'address_city',
        'address_province',
        'address_postal_code',
        'address_country',
        'preferred_contact',
        'is_active',
        'deactivation_reason',
        'deletion_reason',
    ];

    private static function normalizeHumanName(mixed $value): string
    {
        $trimmed = preg_replace('/\s+/', ' ', trim((string) $value));
        if ($trimmed === '') {
            return '';
        }

        return mb_convert_case($trimmed, MB_CASE_TITLE, 'UTF-8');
    }

    protected function firstName(): Attribute
    {
        return Attribute::make(set: fn ($value) => self::normalizeHumanName($value));
    }

    protected function lastName(): Attribute
    {
        return Attribute::make(set: fn ($value) => self::normalizeHumanName($value));
    }

    protected function ecFirstName(): Attribute
    {
        return Attribute::make(set: fn ($value) => self::normalizeHumanName($value));
    }

    protected function ecLastName(): Attribute
    {
        return Attribute::make(set: fn ($value) => self::normalizeHumanName($value));
    }

    // Returns "First Last" for display — never store full_name in DB (v2.0 schema removed it)
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    // Our owner profile optionally links to one login account in users.
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // One owner can register many pets.
    public function pets(): HasMany
    {
        return $this->hasMany(Pet::class, 'owner_id');
    }

    // One owner can receive many notifications from our system.
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'owner_id');
    }
}
