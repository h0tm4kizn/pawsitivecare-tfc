<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBreedRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('name')) {
            $n = (string) $this->input('name');
            $n = preg_replace('/[\x00-\x1F\x7F\x{FFFD}]+/u', '', $n);
            $n = preg_replace('/\s+/u', ' ', $n);
            $this->merge(['name' => trim($n)]);
        }
    }
    public function authorize(): bool
    {
        return $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        $id = $this->route('breed')?->id;
        return [
            'species_id' => 'sometimes|uuid|exists:species_types,id',
            'name'       => ['sometimes', 'string', 'max:100', Rule::unique('breeds', 'name')->ignore($id)],
            'is_active'  => 'boolean',
        ];
    }
}
