<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\AppointmentAvailabilityService;
use Illuminate\Http\Request;

class AppointmentAvailabilityController extends Controller
{
    public function __construct(private readonly AppointmentAvailabilityService $availabilityService)
    {
    }

    public function availableSlots(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);
        $result = $this->availabilityService->availableSlots($request);

        return $result['status'] === 200
            ? $this->success($result['data'], $result['message'])
            : $this->error($result['message'], $result['status']);
    }

    public function hotelCalendarAvailability(Request $request)
    {
        $serviceId = $request->query('service_id');
        $month = $request->query('month');
        if (!$serviceId || !$month) {
            return $this->error('service_id and month are required.', 422);
        }

        $result = $this->availabilityService->hotelCalendarAvailability(
            $serviceId,
            $month,
            $request->query('suite_id'),
            $request->query('exclude_appointment_id'),
            $request->query('pet_id')
        );

        return $this->success($result['data'], $result['message']);
    }
}
