<?php

namespace App\Http\Requests;

class StoreNotificationRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        return [
            'owner_id'       => 'required|uuid|exists:owners,id',
            'appointment_id' => 'required|uuid|exists:appointments,id',
            'message'        => 'required|string',
            'channel'        => 'required|in:phone,email',
            'type'           => 'required|in:reminder,confirmation,followup',
            'sent_at'        => 'nullable|date',
        ];
    }

    public function messages(): array
    {
        return [
            'owner_id.exists' => 'The selected owner does not exist.',
            'appointment_id.exists' => 'The selected appointment does not exist.',
            'channel.in' => 'Channel must be either phone or email.',
            'type.in' => 'Type must be reminder, confirmation, or followup.',
        ];
    }
}
