<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePromotionRequest;
use App\Models\Promotion;

class PromotionController extends Controller
{
    public function index()
    {
        return $this->success(Promotion::with(['serviceTiers.service', 'inventoryItems:id,item_name'])->latest('starts_on')->latest()->get());
    }

    public function store(StorePromotionRequest $request)
    {
        $data = $request->validated();
        $tierIds = $data['tier_ids'] ?? [];
        $inventoryIds = $data['inventory_ids'] ?? [];
        unset($data['tier_ids'], $data['service_id'], $data['service_ids'], $data['inventory_ids']);
        $promotion = Promotion::create($data);
        $promotion->serviceTiers()->sync($tierIds);
        $promotion->inventoryItems()->sync($inventoryIds);
        return $this->success($promotion->load(['serviceTiers.service', 'inventoryItems']), 'Promotion created successfully.', 201);
    }

    public function update(StorePromotionRequest $request, Promotion $promotion)
    {
        $data = $request->validated();
        $tierIds = $data['tier_ids'] ?? [];
        $inventoryIds = $data['inventory_ids'] ?? [];
        unset($data['tier_ids'], $data['service_id'], $data['service_ids'], $data['inventory_ids']);
        $promotion->update($data);
        $promotion->serviceTiers()->sync($tierIds);
        $promotion->inventoryItems()->sync($inventoryIds);
        return $this->success($promotion->load(['serviceTiers.service', 'inventoryItems']), 'Promotion updated successfully.');
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();
        return $this->success(null, 'Promotion deleted successfully.');
    }
}
