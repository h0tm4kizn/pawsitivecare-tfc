<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ServiceAddon;
use App\Http\Requests\StoreServiceAddonRequest;
use App\Http\Requests\UpdateServiceAddonRequest;

class ServiceAddonController extends Controller
{
    // 1. Validate request
    // 2. Authorize via policy
    // 3. Business logic (handled in service/model)

    public function index(Request $request)
    {
        $this->authorize('viewAny', ServiceAddon::class);

        $query = ServiceAddon::query();
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        $addons = $query->orderBy('category')->orderBy('name')->get();
        return $this->success($addons, 'Service addons retrieved successfully.');
    }

    public function store(StoreServiceAddonRequest $request)
    {
        $this->authorize('create', ServiceAddon::class);
        $data = $request->validated();
        $tiers = $data['tiers'] ?? null;
        unset($data['tiers']);

        $data = $this->normalizeAddonPayload($data);

        if (is_array($tiers) && count($tiers) > 0) {
            $created = collect($tiers)->map(function ($tier) use ($data) {
                return ServiceAddon::create([
                    ...$data,
                    'tier_label' => trim((string)($tier['tier_label'] ?? '')) ?: null,
                    'price_min' => $tier['price_min'],
                    'price_max' => $tier['price_max'] ?? null,
                    'has_size_pricing' => true,
                ]);
            })->values();

            return $this->success($created, 'Service addon tiers created successfully.', 201);
        }

        $addon = ServiceAddon::create($data);
        return $this->success($addon, 'Service addon created successfully.', 201);
    }

    public function show(ServiceAddon $serviceAddon)
    {
        $this->authorize('view', $serviceAddon);
        return $this->success($serviceAddon, 'Service addon retrieved successfully.');
    }

    public function update(UpdateServiceAddonRequest $request, ServiceAddon $serviceAddon)
    {
        $this->authorize('update', $serviceAddon);
        $data = $this->normalizeAddonPayload($request->validated());

        if (array_key_exists('is_active', $data) && !$data['is_active']) {
            $reason = trim((string) ($data['deactivation_reason'] ?? $data['action_reason'] ?? ''));
            if ($reason === '') {
                return $this->error('Reason is required when deactivating an add-on.', 422);
            }
            $data['deactivation_reason'] = $reason;
        }

        if (array_key_exists('is_active', $data) && $data['is_active']) {
            $data['deactivation_reason'] = null;
        }

        unset($data['action_reason']);
        $serviceAddon->update($data);
        return $this->success($serviceAddon, 'Service addon updated successfully.');
    }

    private function normalizeAddonPayload(array $data): array
    {
        $group = trim((string)($data['addon_group'] ?? ''));
        if ($group !== '') {
            $data['addon_group'] = $group;
        }

        $appliesToGrooming = (bool)($data['applies_to_grooming'] ?? false);
        $appliesToDaycare = (bool)($data['applies_to_daycare'] ?? false);
        $appliesToHotel = (bool)($data['applies_to_hotel'] ?? false);

        if (!$appliesToGrooming && !$appliesToDaycare && !$appliesToHotel) {
            $category = (string)($data['category'] ?? '');
            $appliesToGrooming = in_array($category, ['grooming_extra', 'grooming_addon', 'treatment'], true);
            $appliesToDaycare = $category === 'daycare_upgrade';
            $appliesToHotel = $category === 'hotel_addon';
        }

        $data['applies_to_grooming'] = $appliesToGrooming;
        $data['applies_to_daycare'] = $appliesToDaycare;
        $data['applies_to_hotel'] = $appliesToHotel;

        if (empty($data['category'])) {
            if ($appliesToDaycare && !$appliesToGrooming && !$appliesToHotel) {
                $data['category'] = 'daycare_upgrade';
            } elseif ($appliesToHotel && !$appliesToGrooming && !$appliesToDaycare) {
                $data['category'] = 'hotel_grooming';
            } else {
                $data['category'] = 'grooming_extra';
            }
        }

        return $data;
    }

    public function destroy(ServiceAddon $serviceAddon)
    {
        $this->authorize('delete', $serviceAddon);
        $serviceAddon->delete();
        return $this->success(null, 'Service addon deleted successfully.');
    }
}
