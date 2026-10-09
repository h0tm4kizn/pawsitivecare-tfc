<?php

namespace App\Http\Requests;

class UpdateServiceAddonRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        $addonId = $this->route('service_addon')?->id;

        return [
            'name'             => 'sometimes|required|string|max:150|unique:service_addons,name,' . $addonId,
            'category'         => 'sometimes|required|string|max:50',
            'addon_group'      => 'sometimes|nullable|string|max:100',
            'tier_label'       => 'sometimes|nullable|string|max:80',
            'price_min'        => 'sometimes|required|numeric|min:0',
            'price_max'        => 'nullable|numeric|gte:price_min',
            'has_size_pricing' => 'sometimes|boolean',
            'applies_to_grooming' => 'sometimes|boolean',
            'applies_to_daycare'  => 'sometimes|boolean',
            'applies_to_hotel'    => 'sometimes|boolean',
            'is_active'        => 'sometimes|boolean',
            'deactivation_reason' => 'nullable|string|max:1000|required_if:is_active,false',
            'action_reason'       => 'nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'deactivation_reason.required_if' => 'Reason is required when deactivating an add-on.',
        ];
    }
}
