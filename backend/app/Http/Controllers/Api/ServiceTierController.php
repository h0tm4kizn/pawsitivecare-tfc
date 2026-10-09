<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceTier;
use Illuminate\Http\Request;

class ServiceTierController extends Controller
{
    /**
     * Update a service tier's price and duration.
     * PUT /service-tiers/{serviceTier}
     */
    public function update(Request $request, ServiceTier $serviceTier)
    {
        $data = $request->validate([
            'price'          => 'sometimes|numeric|min:0',
            'duration_hours' => 'sometimes|numeric|min:0',
            'size_label'     => 'sometimes|string|max:50',
        ], [
            'price.numeric'          => 'Price must be a valid number.',
            'price.min'              => 'Price cannot be negative.',
            'duration_hours.numeric' => 'Duration must be a valid number.',
            'duration_hours.min'     => 'Duration cannot be negative.',
        ]);

        $serviceTier->update($data);

        return $this->success($serviceTier, 'Tier updated successfully.');
    }

    /**
     * Create a new service tier.
     * POST /service-tiers
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'service_id'     => 'required|uuid|exists:services,id',
            'size_label'     => 'required|string|max:50',
            'price'          => 'required|numeric|min:0',
            'duration_hours' => 'nullable|numeric|min:0',
        ]);

        $tier = ServiceTier::create($data);

        return $this->success($tier, 'Tier created successfully.', 201);
    }

    /**
     * Delete a service tier.
     * DELETE /service-tiers/{serviceTier}
     */
    public function destroy(ServiceTier $serviceTier)
    {
        $serviceTier->delete();
        return $this->success(null, 'Tier deleted successfully.');
    }
}
