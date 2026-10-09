<?php

namespace App\Http\Requests;

class StoreAppointmentRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        return [
            'pet_id'               => 'required|uuid|exists:pets,id',
            'service_id'           => 'required_without:booked_packages|nullable|uuid|exists:services,id',
            'promotion_id'         => 'nullable|uuid|exists:promotions,id',
            'hotel_suite_id'       => 'nullable|uuid|exists:hotel_suites,id',
            'handled_by'           => 'nullable|uuid|exists:users,id',
            'booked_by_owner_id'   => 'nullable|uuid|exists:owners,id',
            'size_label'           => 'required|string|max:50',
            'pet_size'             => 'nullable|string|max:20',
            'appointment_date'     => 'required|date|after_or_equal:today',
            'start_time'           => 'required|date_format:H:i,H:i:s',
            'daycare_duration'     => 'nullable|in:hourly,half_day,full_day',
            'hotel_nights'         => 'nullable|integer|min:1|max:30',
            'special_instructions' => 'nullable|string|max:500',
            'notes'                => 'nullable|string|max:500',
            // Hotel reservation deposit reference only.
            'deposit'              => 'nullable|numeric|min:0',
            'reference_number'     => 'nullable|string|max:30|regex:/^[A-Za-z0-9]+$/',
            'has_deposit_proof'    => 'nullable|boolean',
            'booking_source'       => 'nullable|in:online,admin,walk_in',
            'reservation_channel'  => 'nullable|in:cash,e_wallet,bank_transfer',
            'reservation_provider' => 'nullable|string|max:80',
            'reservation_payment_account_id' => 'nullable|string|max:80',
            'reservation_payer_provider' => 'nullable|string|max:80',
            'addons'               => 'nullable|array',
            'addons.*.addon_id'    => 'required|uuid|exists:service_addons,id',
            'addons.*.price_charged' => 'nullable|numeric|min:0',
            'addons.*.notes'       => 'nullable|string',
            'booked_packages'      => 'nullable|array|min:1',
            'booked_packages.*.service_id' => 'required|uuid|exists:services,id',
            'booked_packages.*.size_label' => 'nullable|string|max:50',
            'booked_packages.*.pet_size' => 'nullable|string|max:20',
            'booked_packages.*.start_time' => 'nullable|date_format:H:i,H:i:s',
            'booked_packages.*.appointment_date' => 'nullable|date|after_or_equal:today',
            'booked_packages.*.daycare_duration' => 'nullable|in:hourly,half_day,full_day',
            'booked_packages.*.hotel_suite_id' => 'nullable|uuid|exists:hotel_suites,id',
            'booked_packages.*.hotel_nights' => 'nullable|integer|min:1|max:30',
            'additional_pet_ids' => 'nullable|array|max:2',
            'additional_pet_ids.*' => 'uuid|exists:pets,id|distinct',
            'daycare_pet_sizes' => 'nullable|array|max:3',
            'daycare_pet_sizes.*.pet_id' => 'required_with:daycare_pet_sizes|uuid|exists:pets,id',
            'daycare_pet_sizes.*.size_label' => 'required_with:daycare_pet_sizes|string|max:50',
        ];
    }

    public function messages(): array
    {
        return [
            'pet_id.required'            => 'Please select a pet.',
            'service_id.required'        => 'Please select a service.',
            'size_label.required'        => 'Please select a size/package.',
            'appointment_date.required'  => 'Please choose an appointment date.',
            'appointment_date.after_or_equal' => 'Appointment date must be today or in the future.',
            'start_time.required'        => 'Please choose a start time.',
            'reference_number.regex'     => 'Reference number may contain letters and numbers only.',
            'reference_number.max'       => 'Reference number must not exceed 30 characters.',
        ];
    }
}
