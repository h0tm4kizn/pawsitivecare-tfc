<?php

namespace App\Http\Requests;

class UpdateAppointmentRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        return [
            'service_id'           => 'sometimes|uuid|exists:services,id',
            'promotion_id'         => 'sometimes|nullable|uuid|exists:promotions,id',
            'appointment_date'     => 'sometimes|date',
            'start_time'           => 'sometimes|date_format:H:i,H:i:s',
            'size_label'           => 'sometimes|string|max:50',
            'pet_size'             => 'sometimes|nullable|string|max:20',
            'handled_by'           => 'sometimes|nullable|uuid|exists:users,id',
            'hotel_suite_id'       => 'sometimes|nullable|uuid|exists:hotel_suites,id',
            'daycare_duration'     => 'sometimes|nullable|in:hourly,half_day,full_day',
            'hotel_nights'         => 'sometimes|nullable|integer|min:1',
            'check_out_time'       => 'sometimes|nullable|date',
            'actual_check_in_at'   => 'sometimes|nullable|date',
            'late_checkin_reason' => 'sometimes|nullable|in:traffic_delay,owner_schedule_conflict,emergency_situation,late_arrival_notice_given,other',
            'late_checkin_other_reason' => 'sometimes|nullable|string|max:1000',
            'late_checkin_staff_notes' => 'sometimes|nullable|string|max:1000',
            'actual_check_out_at'  => 'sometimes|nullable|date|after_or_equal:actual_check_in_at',
            'late_checkout_notes'  => 'sometimes|nullable|string|max:1000',
            'late_checkout_reason' => 'sometimes|nullable|in:customer_pickup_delay,extended_pet_observation,staff_release_coordination,emergency_situation,other',
            'late_checkout_other_reason' => 'sometimes|nullable|string|max:1000',
            'late_checkout_staff_notes' => 'sometimes|nullable|string|max:1000',
            'special_instructions' => 'sometimes|nullable|string|max:500',
            'notes'                => 'sometimes|nullable|string',
            // Hotel reservation deposit reference only.
            'deposit'              => 'sometimes|nullable|numeric|min:0',
            'reference_number'     => 'sometimes|nullable|string|max:30|regex:/^[A-Za-z0-9]+$/',
            'reservation_channel'  => 'sometimes|nullable|in:cash,e_wallet,bank_transfer',
            'reservation_payment_account_id' => 'sometimes|nullable|string|max:80',
            'reservation_payer_provider' => 'sometimes|nullable|string|max:80',
            'addons'               => 'sometimes|array|max:3',
            'addons.*.addon_id'    => 'required_with:addons|uuid|exists:service_addons,id',
        ];
    }

    public function messages(): array
    {
        return [
            'appointment_date.after_or_equal' => 'Appointment date must be today or in the future.',
            'daycare_duration.in'             => 'Daycare duration must be hourly, half_day, or full_day.',
            'reference_number.regex'          => 'Reference number may contain letters and numbers only.',
            'reference_number.max'            => 'Reference number must not exceed 30 characters.',
            'addons.max'                       => 'You may select up to three Pawsome Extras.',
        ];
    }
}
