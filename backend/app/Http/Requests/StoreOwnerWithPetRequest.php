<?php

namespace App\Http\Requests;

class StoreOwnerWithPetRequest extends AdminStaffRequest
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
            'email'          => $email !== '' ? $email : null,
            'phone'          => $digits ? substr($digits, 0, 11) : null,
            'address_country' => 'PH',
        ]);
    }

    public function rules(): array
    {
        return [
            // Owner
            'first_name'        => 'required|string|max:100',
            'last_name'         => 'required|string|max:100',
            'email'             => 'nullable|email|max:150|unique:owners,email|unique:users,email',
            'phone'             => 'required|regex:/^09\d{9}$/|unique:owners,phone|unique:users,phone',
            'password'          => 'required|string|min:8',
            'address'           => 'nullable|string',
            'address_unit_floor'=> 'nullable|string|max:120',
            'address_street'    => 'nullable|string|max:255',
            'address_barangay'  => 'nullable|string|max:120',
            'address_city'      => 'nullable|string|max:120',
            'address_province'  => 'nullable|string|max:120',
            'address_postal_code'=> 'nullable|string|max:10',
            'address_country'   => 'nullable|in:PH',
            'preferred_contact' => 'sometimes|in:email,phone,both',
            'ec_first_name'     => 'nullable|string|max:100',
            'ec_last_name'      => 'nullable|string|max:100',
            'ec_relationship'   => 'nullable|string|max:120',
            'ec_email'          => 'nullable|email|max:150',
            'ec_phone'          => 'nullable|string|max:20',

            // Pet (required)
            'pet_name'          => 'required|string|max:100',
            'species_id'        => 'required|uuid|exists:species_types,id',
            'breed_id'          => 'nullable|uuid|exists:breeds,id',
            'pet_sex'           => 'required|in:male,female',
            'pet_dob'           => 'nullable|date|before_or_equal:today',
            'weight_kg'         => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
            'medical_notes'     => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'phone.required' => 'A phone number (09XXXXXXXXX) is required.',
            'phone.regex'    => 'Phone must start with 09 and be exactly 11 digits (e.g. 09XXXXXXXXX).',
            'phone.unique'   => 'An account with this phone number already exists.',
            'email.unique'   => 'An account with this email already exists.',
        ];
    }
}
