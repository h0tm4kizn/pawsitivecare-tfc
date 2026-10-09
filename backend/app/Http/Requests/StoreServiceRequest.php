<?php

namespace App\Http\Requests;

class StoreServiceRequest extends AdminStaffRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('status') && !$this->has('is_active')) {
            $this->merge(['is_active' => $this->input('status') === 'Active']);
        }
    }

    public function rules(): array
    {
        return [
            'name'        => 'required|string|max:150',
            'category'    => 'required|string|max:50|exists:service_categories,slug',
            'description' => 'nullable|string',
            'is_active'   => 'sometimes|boolean',
            'needs_cage'  => 'sometimes|boolean',
        ];
    }
}
