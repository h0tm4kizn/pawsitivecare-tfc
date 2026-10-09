<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;


class User extends Authenticatable
{
    use HasFactory, HasUuids, HasApiTokens, SoftDeletes;

    protected $table = 'users';

    protected $fillable = [
        'display_id',
        'name',
        'email',
        'password_hash',
        'role',
        'staff_type',
        'is_active',
        'phone',
        'email_verified_at',
        'phone_verified_at',
        'deactivation_reason',
        'deletion_reason',
        'totp_secret',
        'totp_pending_secret',
        'totp_enabled',
        'totp_recovery_codes',
    ];

    protected $hidden = [
        'password_hash',
        'totp_secret',
        'totp_pending_secret',
        'totp_recovery_codes',
        'qr_credential',
    ];

    protected $casts = [
        'is_active'          => 'boolean',
        'email_verified_at'  => 'datetime',
        'phone_verified_at'  => 'datetime',
        'totp_enabled'       => 'boolean',
        'totp_recovery_codes'=> 'array',
    ];

    public const STAFF_TYPE_FRONT_DESK = 'front_desk';
    public const STAFF_TYPE_GROOMER = 'groomer';

    public static function normalizeStaffType(?string $value): ?string
    {
        return match (strtolower(trim((string) $value))) {
            'technical' => self::STAFF_TYPE_FRONT_DESK,
            'field' => self::STAFF_TYPE_GROOMER,
            self::STAFF_TYPE_FRONT_DESK => self::STAFF_TYPE_FRONT_DESK,
            self::STAFF_TYPE_GROOMER => self::STAFF_TYPE_GROOMER,
            default => $value === null ? null : trim($value),
        };
    }

    private static function normalizeHumanName(mixed $value): string
    {
        $trimmed = preg_replace('/\s+/', ' ', trim((string) $value));
        if ($trimmed === '') {
            return '';
        }

        return mb_convert_case($trimmed, MB_CASE_TITLE, 'UTF-8');
    }

    protected function name(): Attribute
    {
        return Attribute::make(set: fn ($value) => self::normalizeHumanName($value));
    }

    public function getAuthPassword()
    {
         return $this->password_hash;
    }

    // Checks if the logged-in user is an admin
    // Used in controllers: if ($user->isAdmin()) show all records
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    // Checks if the logged-in user is a staff member
    // Used in AppointmentController to filter own appointments only
    public function isStaff(): bool
    {
        $role = strtolower(trim((string) $this->role));

        if ($role === 'staff') {
            return true;
        }

        // Backward compatibility for legacy rows where role stored the
        // staff subtype instead of the canonical "staff" role.
        if (in_array($role, [
            self::STAFF_TYPE_FRONT_DESK,
            self::STAFF_TYPE_GROOMER,
            'groomer',
            'attendant',
            'receptionist',
            'frontdesk',
            'front_desk',
            'assistant',
            'cashier',
            'daycare',
            'daycare_assistant',
        ], true)) {
            return true;
        }

        $staffType = strtolower(trim((string) $this->staff_type));
        return $role === '' && in_array($staffType, [self::STAFF_TYPE_FRONT_DESK, self::STAFF_TYPE_GROOMER], true);
    }

    // Checks if the logged-in user is a customer
    // Used in customer route group controllers
    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    // Checks if staff member has system login access (email required)
    // Used in StaffController and system-access gating (Task #7, #64a)
    public function isFrontDeskStaff(): bool
    {
        return self::normalizeStaffType($this->staff_type) === self::STAFF_TYPE_FRONT_DESK;
    }

    public function canOperateFrontDesk(): bool
    {
        return $this->isAdmin() || $this->isFrontDeskStaff();
    }

    // Checks if staff member is a groomer.
    // Groomers may not have system login — email not required (Task #7)
    public function isGroomer(): bool
    {
        return self::normalizeStaffType($this->staff_type) === self::STAFF_TYPE_GROOMER;
    }

    // Links this customer account to their owner profile (1:1)
    // Usage: auth()->user()->owner->id
    public function owner()
    {
        return $this->hasOne('App\Models\Owner', 'user_id');
    }
}
