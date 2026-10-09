<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Services\AppointmentLifecycleService;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Http\Requests\UpdateAppointmentStatusRequest;

class AppointmentStatusController extends Controller
{
    public function __construct(private readonly AppointmentLifecycleService $lifecycleService) {}

    public function updateStatus(UpdateAppointmentStatusRequest $request, Appointment $appointment)
    {
        return $this->lifecycleService->updateStatus($request, $appointment);
    }

    public function cancelOwn(Appointment $appointment, Request $request)
    {
        return $this->lifecycleService->cancelOwn($appointment, $request);
    }
}
