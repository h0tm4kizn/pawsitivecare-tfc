<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePetHealthFormRequest extends FormRequest
{
    /**
     * Customer health-form endpoints are protected by auth:sanctum + role:customer.
     */
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'service_id'           => 'nullable|uuid|exists:services,id',
            'appointment_id'       => 'nullable|uuid|exists:appointments,id',
            'weight_kg'            => ['required', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'gt:0', 'max:99.99'],
            'is_vaccinated'        => 'nullable|in:Yes,No',
            'vaccine_date'         => 'nullable|date|before_or_equal:today',
            'vaccines'             => 'nullable|array',
            'vaccines.*'           => 'nullable|string|max:255',
            'vaccine_records'      => 'nullable|array',
            'vaccine_records.*'    => 'nullable|date|before_or_equal:today',
            'vaccine_5in1'         => 'nullable|boolean',
            'vaccine_rabies'       => 'nullable|boolean',
            'vet_clinic_name'      => 'nullable|string|max:150',
            'vet_contact_number'   => ['nullable', 'string', 'max:30', 'regex:/^(?:\\+63|0)9\\d{9}$/'],
            'is_friendly'          => 'nullable|in:socialize,alone',
            'treat_preference'     => 'nullable|in:can_treats,no_treats',
            'allergies'            => 'nullable|string|max:500',
            'has_ticks'            => 'nullable|boolean',
            'has_flea'             => 'nullable|boolean',
            'has_wound'            => 'nullable|boolean',
            'has_mange'            => 'nullable|boolean',
            'has_bald_spot'        => 'nullable|boolean',
            'has_skin_problem'     => 'nullable|boolean',
            'has_lameness'         => 'nullable|boolean',
            'has_eye_discharge'    => 'nullable|boolean',
            'has_nasal_discharge'  => 'nullable|boolean',
            'has_ear_discharge'    => 'nullable|boolean',
            'medical_conditions'   => 'nullable|string|max:1000',
            'declaration_accepted' => 'nullable|boolean',
        ];
    }

    protected function prepareForValidation(): void
    {
        $isVaccinated = $this->input('is_vaccinated');
        if ($isVaccinated === true || $isVaccinated === 1 || $isVaccinated === '1' || (is_string($isVaccinated) && strtolower(trim($isVaccinated)) === 'yes')) {
            $this->merge(['is_vaccinated' => 'Yes']);
        } elseif ($isVaccinated === false || $isVaccinated === 0 || $isVaccinated === '0' || (is_string($isVaccinated) && strtolower(trim($isVaccinated)) === 'no')) {
            $this->merge(['is_vaccinated' => 'No']);
        }

        $isFriendly = $this->input('is_friendly');
        if ($isFriendly === 'Yes') {
            $this->merge(['is_friendly' => 'socialize']);
        } elseif ($isFriendly === 'No') {
            $this->merge(['is_friendly' => 'alone']);
        }

        $weight = $this->input('weight_kg');
        if (is_string($weight)) {
            $trimmed = trim($weight);
            if ($trimmed !== '' && is_numeric($trimmed)) {
                $this->merge(['weight_kg' => number_format((float) $trimmed, 2, '.', '')]);
            }
        }

        $vetContact = $this->input('vet_contact_number');
        if (is_string($vetContact)) {
            $normalized = preg_replace('/\D+/', '', $vetContact);
            if (str_starts_with($normalized, '63') && strlen($normalized) === 12) {
                $normalized = '0' . substr($normalized, 2);
            }
            if (str_starts_with($normalized, '09') && strlen($normalized) === 11) {
                $this->merge(['vet_contact_number' => $normalized]);
            }
        }

        foreach (['allergies', 'medical_conditions', 'vet_clinic_name'] as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $clean = trim($value);
                if ($clean !== '' && preg_match('/^n\/?a$/i', $clean)) {
                    $this->merge([$field => 'None']);
                }
            }
        }
    }

    public function messages(): array
    {
        return [
            'weight_kg.required' => 'Current weight is required.',
            'weight_kg.regex' => 'Weight must be up to 99.99 kg with up to 2 decimals.',
            'weight_kg.gt' => 'Current weight must be greater than 0 kg.',
            'vet_contact_number.regex' => 'Vet contact number must be a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX).',
        ];
    }
}
