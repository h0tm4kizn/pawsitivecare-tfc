<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRegisterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $digits = preg_replace('/\D+/', '', (string) ($this->input('phone') ?? ''));
        if ($digits && str_starts_with($digits, '63')) {
            $digits = substr($digits, 2);
        }
        if ($digits && !str_starts_with($digits, '0')) {
            $digits = '0' . $digits;
        }

        $email = strtolower(trim((string) $this->input('email')));

        $this->merge([
            'email' => $email !== '' ? $email : null,
            'phone' => $digits ? substr($digits, 0, 11) : null,
            'address_country' => strtoupper(trim((string) ($this->input('address_country') ?: 'PH'))),
            'address_postal_code' => $this->filled('address_postal_code')
                ? substr(preg_replace('/\D+/', '', (string) $this->input('address_postal_code')), 0, 4)
                : null,
        ]);
    }

    /**
     * Registration is a public endpoint — no auth required.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Owner fields
            'first_name'            => 'required|string|max:100',
            'last_name'             => 'required|string|max:100',
            'email'                 => 'required|email|max:150|unique:users,email|unique:owners,email',
            'phone'                 => 'required|regex:/^09\d{9}$/|unique:users,phone|unique:owners,phone',
            'password'              => 'required|string|min:8|confirmed',
            'address'               => 'nullable|string',
            'address_unit_floor'    => 'nullable|string|max:120',
            'address_street'        => 'nullable|string|max:255',
            'address_barangay'      => 'nullable|string|max:120',
            'address_city'          => 'nullable|string|max:120',
            'address_province'      => 'nullable|string|max:120',
            'address_postal_code'   => 'nullable|digits:4',
            'address_country'       => 'nullable|in:PH',
            'preferred_contact'     => 'sometimes|in:email,phone,both',
            
            // Initial pet fields
            'pet_name'              => 'required|string|max:100',
            'species_id'            => 'required|uuid|exists:species_types,id',
            'breed_id'              => 'required|uuid|exists:breeds,id',
            'pet_sex'               => 'required|in:male,female',
            'pet_dob'               => 'nullable|date|before_or_equal:today',
            'pet_weight'            => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique'             => 'An account with this email already exists.',
            'email.required'           => 'Email is required to create an account.',
            'phone.required'           => 'A phone number (09XXXXXXXXX) is required to create an account.',
            'phone.regex'              => 'Phone must start with 09 and be exactly 11 digits (e.g. 09XXXXXXXXX).',
            'phone.unique'             => 'An account with this phone number already exists.',
            'password.confirmed'       => 'Password confirmation does not match.',
            'password.min'             => 'Password must be at least 8 characters.',
        ];
    }
}
