<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSpeciesTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        $id = $this->route('species_type')?->id;
        return [
            'name'      => ['sometimes', 'string', 'max:50', Rule::unique('species_types', 'name')->ignore($id)],
            'code'      => ['sometimes', 'string', 'max:1',  Rule::unique('species_types', 'code')->ignore($id)],
            'is_active' => 'boolean',
    ];
}
}
