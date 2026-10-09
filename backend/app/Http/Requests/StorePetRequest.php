<?php

namespace App\Http\Requests;

class StorePetRequest extends AdminStaffRequest
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
            'owner_id'        => 'required|uuid|exists:owners,id',
            'species_id'      => 'required|uuid|exists:species_types,id',
            'breed_id'        => 'nullable|uuid|exists:breeds,id',
            'name'            => 'required|string|max:100',
            'sex'             => 'required|in:male,female',
            'date_of_birth'   => 'nullable|date|before_or_equal:today',
            'weight_kg'       => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
            'medical_notes'   => 'nullable|string',
            'photo_url'       => 'nullable|url',
        ];
    }

    public function messages(): array
    {
        return [
            'owner_id.exists'              => 'The selected owner does not exist.',
            'species_id.exists'            => 'The selected species does not exist.',
            'breed_id.exists'              => 'The selected breed does not exist.',
            'sex.in'                       => 'Sex must be male or female.',
            'date_of_birth.before_or_equal' => 'Date of birth cannot be a future date.',
        ];
    }
}
