<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSpeciesTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        return [
            'name'      => 'required|string|max:50|unique:species_types,name',
            'is_active' => 'boolean',
        ];
    }
}
