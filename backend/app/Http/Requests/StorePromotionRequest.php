<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StorePromotionRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:150',
            'description' => 'nullable|string',
            'discount_type' => ['required', Rule::in(['percentage', 'fixed', 'promotional_price'])],
            'discount_value' => 'nullable|numeric|min:0',
            'promotional_price' => 'nullable|numeric|min:0',
            'starts_on' => 'required|date',
            'ends_on' => 'required|date|after_or_equal:starts_on',
            'is_active' => 'sometimes|boolean',
            'applies_to_all_services' => 'sometimes|boolean',
            'applies_to_all_inventory' => 'sometimes|boolean',
            'service_id' => 'nullable|uuid|exists:services,id',
            'service_ids' => 'nullable|array',
            'service_ids.*' => 'uuid|exists:services,id',
            'tier_ids' => 'nullable|array',
            'tier_ids.*' => 'uuid|exists:service_tiers,id',
            'inventory_ids' => 'nullable|array',
            'inventory_ids.*' => 'uuid|exists:inventory,id',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('discount_type');
            if ($type === 'promotional_price' && $this->input('promotional_price') === null) {
                $validator->errors()->add('promotional_price', 'Set a promotional price.');
            }
            if (in_array($type, ['percentage', 'fixed'], true) && $this->input('discount_value') === null) {
                $validator->errors()->add('discount_value', 'Set a discount value.');
            }
            if ($type === 'percentage' && (float) $this->input('discount_value') > 100) {
                $validator->errors()->add('discount_value', 'Percentage cannot exceed 100.');
            }
            $serviceIds = array_values(array_unique(array_filter($this->input('service_ids', []))));
            if (!$serviceIds && $this->filled('service_id')) {
                $serviceIds = [$this->input('service_id')];
            }
            if ($serviceIds && $this->filled('tier_ids')) {
                $valid = \App\Models\ServiceTier::whereIn('service_id', $serviceIds)
                    ->whereIn('id', $this->input('tier_ids'))->count();
                if ($valid !== count(array_unique($this->input('tier_ids', [])))) {
                    $validator->errors()->add('tier_ids', 'Packages must belong to the selected service.');
                }
            }
            $allServices = $this->boolean('applies_to_all_services');
            $allInventory = $this->boolean('applies_to_all_inventory');
            if (!$allServices && !$serviceIds && !$allInventory && !$this->filled('inventory_ids')) {
                $validator->errors()->add('service_id', 'Select at least one service package or retail product.');
            }
        });
    }
}
