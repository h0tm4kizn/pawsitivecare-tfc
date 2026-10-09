<?php

namespace App\Http\Requests;

class StoreBreedRequest extends AdminStaffRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $n = (string) $this->input('name');
            // strip replacement char and control chars, normalize spaces
            $n = preg_replace('/[\x00-\x1F\x7F\x{FFFD}]+/u', '', $n);
            $n = preg_replace('/\s+/u', ' ', $n);
            $this->merge(['name' => trim($n)]);
        }
    }
    public function rules(): array
    {
        return [
            'species_id' => 'required|exists:species_types,id',
            'name' => 'required|string|max:50|unique:breeds,name,NULL,id,species_id,' . $this->input('species_id'),
            'is_active' => 'boolean',
        ];
    }
}
