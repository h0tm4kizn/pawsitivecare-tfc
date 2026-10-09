<?php

namespace App\Http\Requests;

class StoreServiceAddonRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        return [
            'name'             => 'required|string|max:150',
            'category'         => 'sometimes|string|max:50',
            'addon_group'      => 'nullable|string|max:100',
            'tier_label'       => 'nullable|string|max:80',
            'price_min'        => 'required_without:tiers|nullable|numeric|min:0',
            'price_max'        => 'nullable|numeric|min:0|gte:price_min',
            'has_size_pricing' => 'sometimes|boolean',
            'applies_to_grooming' => 'sometimes|boolean',
            'applies_to_daycare'  => 'sometimes|boolean',
            'applies_to_hotel'    => 'sometimes|boolean',
            'is_active'        => 'sometimes|boolean',
            'tiers'            => 'sometimes|array',
            'tiers.*.tier_label' => 'nullable|string|max:80',
            'tiers.*.price_min'  => 'required_with:tiers|numeric|min:0',
            'tiers.*.price_max'  => 'nullable|numeric|min:0',
        ];
    }
}
