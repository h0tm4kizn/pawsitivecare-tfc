<?php

namespace App\Http\Requests;

class StoreOwnerRequest extends AdminStaffRequest
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

        $this->merge([
            'email' => strtolower(trim((string) $this->input('email'))),
            'phone' => $normalizePhone($this->input('phone')),
            'ec_email' => $this->filled('ec_email') ? strtolower(trim((string) $this->input('ec_email'))) : null,
            'ec_phone' => $normalizePhone($this->input('ec_phone')),
            'address_country' => strtoupper(trim((string) ($this->input('address_country') ?: 'PH'))),
            'address_postal_code' => $this->filled('address_postal_code')
                ? substr(preg_replace('/\D+/', '', (string) $this->input('address_postal_code')), 0, 4)
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'first_name'        => 'required|string|max:100',
            'last_name'         => 'required|string|max:100',
            'email'             => 'required|email|max:150|unique:owners,email|unique:users,email',
            'phone'             => ['required', 'regex:/^09\d{9}$/', 'max:20', 'unique:owners,phone', 'unique:users,phone'],
            'password'          => 'nullable|string|min:8',
            'address'           => 'nullable|string',
            'address_unit_floor'=> 'nullable|string|max:120',
            'address_street'    => 'nullable|string|max:255',
            'address_barangay'  => 'nullable|string|max:120',
            'address_city'      => 'nullable|string|max:120',
            'address_province'  => 'nullable|string|max:120',
            'address_postal_code'=> 'nullable|digits:4',
            'address_country'   => 'nullable|in:PH',
            'preferred_contact' => 'required|in:email,phone,both',
            'ec_first_name'     => 'nullable|string|max:100',
            'ec_last_name'      => 'nullable|string|max:100',
            'ec_relationship'   => 'nullable|string|max:120',
            'ec_email'          => 'nullable|email|max:150',
            'ec_phone'          => 'nullable|regex:/^09\d{9}$/',
            'ec_address'        => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'An owner with this email already exists.',
            'phone.unique' => 'This phone number is already used by another account.',
            'password.min' => 'Password must be at least 8 characters.',
        ];
    }
}
