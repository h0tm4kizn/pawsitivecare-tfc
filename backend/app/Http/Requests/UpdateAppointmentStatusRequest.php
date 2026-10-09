<?php

namespace App\Http\Requests;

use App\Models\Appointment;

class UpdateAppointmentStatusRequest extends AdminStaffRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $appointment = $this->route('appointment');
        $isHotelAppointment = $appointment instanceof Appointment
            && strtolower((string) $appointment->service?->category) === 'hotel';

        return [
            'status' => 'required|in:approved,in_progress,completed,cancelled,no_show',
            'handled_by' => 'nullable|uuid|exists:users,id',
            'cancellation_reason' => 'nullable|string|max:500',
            'actual_check_in_at' => 'nullable|date',
            'actual_check_out_at' => 'nullable|date',
            'confirm_hotel_stay_completed' => 'nullable|boolean',
            'missed_checkin_reason' => 'nullable|string|max:1000',
            'deposit' => $isHotelAppointment ? 'nullable|numeric|min:0' : 'prohibited',
            'reference_number' => 'nullable|string|max:30|regex:/^[A-Za-z0-9]+$/',
            'extension_payment_method' => 'nullable|in:cash,e_wallet,bank_transfer',
            'extension_payment_amount' => 'nullable|numeric|min:0',
            'extension_payment_reference' => 'nullable|string|max:100',
            'extension_payment_confirmed' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'reference_number.regex' => 'Reference number may contain letters and numbers only.',
            'reference_number.max' => 'Reference number must not exceed 30 characters.',
        ];
    }
}
