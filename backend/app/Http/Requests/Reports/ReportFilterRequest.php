<?php

namespace App\Http\Requests\Reports;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\User;

class ReportFilterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('staff_type')) {
            $this->merge(['staff_type' => User::normalizeStaffType($this->input('staff_type'))]);
        }
    }

    public function authorize()
    {
        return true; // Policy checked in controller
    }

    public function rules()
    {
        return [
            'view' => 'required|in:monthly,yearly',
            'month' => 'nullable|integer|min:1|max:12',
            'year' => 'required|integer|min:2020|max:2100',
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'staff_id' => 'nullable|uuid',
            'staff_type' => 'nullable|in:front_desk,groomer',
            'service_id' => 'nullable|uuid',
            'status' => 'nullable|in:on_duty,completed,missing_time_out',
            'appointment_status' => 'nullable|in:pending,approved,in_progress,checkin,checked_in,completed,cancelled,no_show',
            'cancellation_type' => 'nullable|in:staff_rejection,staff_cancellation,customer_cancellation,late,normal',
            'per_page' => 'nullable|integer|min:1|max:1000',
            'group' => 'nullable|in:all,activity,attendance,commission',
            'format' => 'nullable|in:csv,pdf',
        ];
    }
}
