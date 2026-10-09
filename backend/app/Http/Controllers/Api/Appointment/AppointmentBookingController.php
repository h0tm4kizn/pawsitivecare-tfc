<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Services\AppointmentBookingService;
use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Http\Requests\StoreAppointmentRequest;

class AppointmentBookingController extends Controller
{
    public function __construct(private readonly AppointmentBookingService $bookingService) {}

    public function store(StoreAppointmentRequest $request)
    {
        return $this->bookingService->store($request);
    }

    public function bookOwn(Request $request)
    {
        return $this->bookingService->bookOwn($request);
    }
}
