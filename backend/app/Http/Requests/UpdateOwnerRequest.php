<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOwnerRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $normalizePhone = static function ($value) {
            $digits = preg_replace('/\D+/', '', (string) ($value ?? ''));
            if (!$digits) return null;
            if (str_starts_with($digits, '63')) $digits = substr($digits, 2);
            if (!str_starts_with($digits, '0')) $digits = '0' . $digits;
            return substr($digits, 0, 11);
        };

        $payload = [];
        if ($this->has('email')) $payload['email'] = strtolower(trim((string) $this->input('email')));
        if ($this->has('phone')) $payload['phone'] = $normalizePhone($this->input('phone'));
        if ($this->has('ec_email')) $payload['ec_email'] = $this->filled('ec_email') ? strtolower(trim((string) $this->input('ec_email'))) : null;
        if ($this->has('ec_phone')) $payload['ec_phone'] = $normalizePhone($this->input('ec_phone'));
        if ($this->has('address_country')) $payload['address_country'] = strtoupper(trim((string) ($this->input('address_country') ?: 'PH')));
        if ($this->has('address_postal_code')) {
            $payload['address_postal_code'] = $this->filled('address_postal_code')
                ? substr(preg_replace('/\D+/', '', (string) $this->input('address_postal_code')), 0, 4)
                : null;
        }
        if (!empty($payload)) $this->merge($payload);
    }

    /**
     * Admin, staff, and the owner themselves can update a profile.
     * Authorization is also enforced in the controller via authorize().
     */
    public function authorize(): bool
    {
        return $this->user()->isAdmin()
            || $this->user()->isStaff()
            || $this->user()->isCustomer();
    }

    public function rules(): array
    {
        // Get the owner being updated from the route parameter,
        // or fall back to the authenticated user's own owner record (PUT /my-profile)
        $ownerId = $this->route('owner')?->id
            ?? \App\Models\Owner::where('user_id', $this->user()->id)->value('id');
        $userId = $this->route('owner')?->user_id ?? $this->user()->id;

        return [
            'first_name'        => 'sometimes|string|max:100',
            'last_name'         => 'sometimes|string|max:100',
            'email'             => [
                'sometimes', 'email', 'max:150',
                Rule::unique('owners', 'email')->ignore($ownerId),
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'phone'             => [
                'sometimes', 'regex:/^09\d{9}$/', 'max:20',
                Rule::unique('owners', 'phone')->ignore($ownerId),
                Rule::unique('users', 'phone')->ignore($userId),
            ],
            'address'           => 'nullable|string',
            'address_unit_floor'=> 'sometimes|nullable|string|max:120',
            'address_street'    => 'sometimes|nullable|string|max:255',
            'address_barangay'  => 'sometimes|nullable|string|max:120',
            'address_city'      => 'sometimes|nullable|string|max:120',
            'address_province'  => 'sometimes|nullable|string|max:120',
            'address_postal_code'=> 'sometimes|nullable|digits:4',
            'address_country'   => 'sometimes|nullable|in:PH',
            'preferred_contact' => 'sometimes|in:email,phone,both',
            'is_active'         => 'sometimes|boolean',
            'deactivation_reason' => 'sometimes|nullable|string|max:1000',
            'deletion_reason'     => 'sometimes|nullable|string|max:1000',
            'ec_first_name'     => 'sometimes|nullable|string|max:100',
            'ec_last_name'      => 'sometimes|nullable|string|max:100',
            'ec_relationship'   => 'sometimes|nullable|string|max:120',
            'ec_email'          => 'sometimes|nullable|email|max:150',
            'ec_phone'          => 'sometimes|nullable|regex:/^09\d{9}$/',
            'ec_address'        => 'sometimes|nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'This email is already used by another account.',
            'phone.unique' => 'This phone number is already used by another account.',
        ];
    }
}
