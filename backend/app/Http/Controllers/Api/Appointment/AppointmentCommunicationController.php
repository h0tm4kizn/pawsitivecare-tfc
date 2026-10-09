<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Mail\ThankYouMail;
use Illuminate\Support\Facades\Mail;

class AppointmentCommunicationController extends Controller
{    /**
     * Send thank you email for a completed appointment.
     * POST /appointments/{appointment}/send-thank-you
     */
    public function sendThankYouEmail(Appointment $appointment)
    {
        $this->authorize('view', $appointment);

        if ($appointment->status !== 'completed') {
            return $this->error('Thank you emails can only be sent for completed appointments.', 422);
        }

        $loaded = $appointment->load(['pet.owner', 'pet.breed', 'service', 'hotelSuite', 'appointmentAddons']);
        $owner  = $loaded->pet->owner;

        if (!$owner?->email) {
            return $this->error('Owner email not found.', 422);
        }

        try {
            Mail::to($owner->email)->send(new ThankYouMail($loaded, $owner, $loaded->pet));
            return $this->success(null, 'Thank you email sent successfully.');
        } catch (\Exception $e) {
            \Log::error('Thank you email failed: ' . $e->getMessage());
            return $this->error('Failed to send thank you email.', 500);
        }
    }

    /**
     * Get service acknowledgment data for a completed appointment.
     * GET /appointments/{appointment}/service-acknowledgment
     */
    public function serviceAcknowledgment(Appointment $appointment)
    {
        $this->authorize('view', $appointment);

        if ($appointment->status !== 'completed') {
            return $this->error('Service acknowledgment is only available for completed appointments.', 422);
        }

        $loaded = $appointment->load([
            'pet.owner',
            'pet.breed',
            'pet.speciesType',
            'service',
            'hotelSuite',
            'appointmentAddons.serviceAddon',
            'handledBy'
        ]);

        $owner = $loaded->pet->owner;
        $pet = $loaded->pet;

        $isHotel = $loaded->service?->category === 'hotel' || $loaded->hotel_nights;
        $isDaycare = $loaded->service?->category === 'daycare';
        $category = $isHotel ? 'Pet Hotel' : ($isDaycare ? 'Daycare' : 'Grooming');

        $addons = $loaded->appointmentAddons->map(fn($a) => [
            'name' => $a->serviceAddon?->name ?? 'Add-on',
            'price' => (float) ($a->price_charged ?? 0),
        ]);

        $basePrice = (float) ($loaded->total_price ?? 0);
        $addonsTotal = $addons->sum('price');
        $grandTotal = $basePrice + $addonsTotal;

        return $this->success([
            'appointment' => [
                'id' => $loaded->id,
                'appointment_code' => $loaded->appointment_code,
                'status' => $loaded->status,
                'appointment_date' => $loaded->appointment_date,
                'start_time' => $loaded->start_time,
                'check_in_time' => $loaded->check_in_time,
                'check_out_time' => $loaded->check_out_time,
                'actual_check_in_at' => $loaded->actual_check_in_at,
                'scheduled_check_in_at' => $loaded->scheduled_check_in_at,
                'late_checkin_indicator' => $loaded->late_checkin_indicator,
                'checkin_time_difference_minutes' => $loaded->checkin_time_difference_minutes,
                'late_checkin_reason' => $loaded->late_checkin_reason,
                'late_checkin_other_reason' => $loaded->late_checkin_other_reason,
                'late_checkin_staff_notes' => $loaded->late_checkin_staff_notes,
                'actual_check_out_at' => $loaded->actual_check_out_at,
                'late_checkout_indicator' => $loaded->late_checkout_indicator,
                'checkout_time_difference_minutes' => $loaded->checkout_time_difference_minutes,
                'completed_at' => $loaded->completed_at,
                'hotel_nights' => $loaded->hotel_nights,
                'size_label' => $loaded->size_label,
                'special_instructions' => $loaded->special_instructions,
                'total_price' => $basePrice,
                'grand_total' => $grandTotal,
            ],
            'service' => [
                'name' => $loaded->service?->name,
                'category' => $category,
            ],
            'hotel_suite' => $loaded->hotelSuite ? [
                'name' => $loaded->hotelSuite->name,
            ] : null,
            'pet' => [
                'name' => $pet->name,
                'breed' => $pet->breed?->name,
                'species' => $pet->speciesType?->name,
                'photo_url' => $pet->photo_url,
            ],
            'owner' => [
                'full_name' => trim(($owner->first_name ?? '') . ' ' . ($owner->last_name ?? '')),
                'email' => $owner->email,
                'phone' => $owner->phone,
                'address' => $owner->address,
            ],
            'handled_by' => $loaded->handledBy ? [
                'name' => $loaded->handledBy->name,
            ] : null,
            'addons' => $addons,
        ], 'Service acknowledgment retrieved successfully.');
    }
}
