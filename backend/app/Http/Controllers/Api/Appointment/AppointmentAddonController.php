<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ServiceAddon;
use App\Services\AppointmentPricingService;
use Illuminate\Http\Request;

class AppointmentAddonController extends Controller
{
    public function __construct(
        private readonly AppointmentPricingService $pricingService,
    ) {
    }

    /**
     * Add an addon to an existing appointment.
     * POST /appointments/{appointment}/addons
     */
    public function store(Request $request, Appointment $appointment)
    {
        $this->authorize('update', $appointment);

        $addon = ServiceAddon::query()->findOrFail($request->addon_id);
        if ((bool) ($addon->is_active ?? true) !== true) {
            return $this->error('This extra is currently inactive.', 422);
        }
        if (!$this->pricingService->addonAppliesToService($addon, $appointment->service)) {
            return $this->error('This extra is not valid for the selected appointment service.', 422);
        }
        $alreadyExists = $appointment->appointmentAddons()
            ->where('addon_id', $addon->id)
            ->exists();
        if ($alreadyExists) {
            return $this->error('This extra has already been added.', 422);
        }

        $appointment->appointmentAddons()->create([
            'addon_id' => $addon->id,
            'price_charged' => (float) ($addon->price_min ?? 0),
            'notes' => $request->notes ?? null,
        ]);

        $this->pricingService->recalculate($appointment);

        return $this->success(
            $appointment->load('appointmentAddons'),
            'Addon added successfully.'
        );
    }

    /**
     * Remove an addon from an appointment.
     * DELETE /appointments/{appointment}/addons/{addonId}
     */
    public function destroy(Appointment $appointment, string $addonId)
    {
        $this->authorize('update', $appointment);

        $appointment->appointmentAddons()->where('id', $addonId)->delete();

        $this->pricingService->recalculate($appointment);

        return $this->success(
            $appointment->load('appointmentAddons'),
            'Addon removed successfully.'
        );
    }
}
