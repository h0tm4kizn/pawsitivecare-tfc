<?php

namespace App\Http\Requests;

class UpdatePetRequest extends AdminStaffRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $v = (string) $this->input('name');
            $v = preg_replace('/[\x00-\x1F\x7F\x{FFFD}]+/u', '', $v);
            $v = preg_replace('/\s+/u', ' ', $v);
            $this->merge(['name' => trim($v)]);
        }
        if ($this->has('medical_notes')) {
            $m = (string) $this->input('medical_notes');
            $m = preg_replace('/[\x00-\x1F\x7F\x{FFFD}]+/u', '', $m);
            $m = preg_replace('/\s+/u', ' ', $m);
            $this->merge(['medical_notes' => trim($m)]);
        }
    }
    public function rules(): array
    {
        return [
            'owner_id'   => 'sometimes|uuid|exists:owners,id',
            'species_id' => 'sometimes|uuid|exists:species_types,id',
            'breed_id'   => 'sometimes|uuid|exists:breeds,id',
            'name'       => 'sometimes|string|max:100',
            'sex'        => 'sometimes|in:male,female',
            'date_of_birth' => 'nullable|date|before_or_equal:today',
            'weight_kg'     => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
            'medical_notes' => 'nullable|string',
            'photo_url'     => 'nullable|url',
            'is_active' => 'sometimes|boolean',
            'deactivation_reason' => 'nullable|string|max:1000|required_if:is_active,false',
            'action_reason' => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'owner_id.exists'   => 'The selected owner does not exist.',
            'species_id.exists' => 'The selected breed does not exist.',
            'breed_id.exists'   => 'The selected breed does not exist.',
            'sex.in'            => 'Sex must be male or female.',
            'date_of_birth.before_or_equal' => 'Date of birth cannot be a future date.',
            'deactivation_reason.required_if' => 'Reason is required when deactivating a pet.',
        ];
    }
}
