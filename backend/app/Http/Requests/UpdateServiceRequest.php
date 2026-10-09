<?php

namespace App\Http\Requests;

class UpdateServiceRequest extends AdminStaffRequest
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
            'name'        => 'sometimes|string|max:150',
            'category'    => 'sometimes|string|max:50|exists:service_categories,slug',
            'description' => 'sometimes|nullable|string',
            'is_active'   => 'sometimes|boolean',
            'needs_cage'  => 'sometimes|boolean',
        ];
    }
}
