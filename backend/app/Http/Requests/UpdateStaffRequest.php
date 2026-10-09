<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\User;

class UpdateStaffRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('staff_type')) {
            $this->merge(['staff_type' => User::normalizeStaffType($this->input('staff_type'))]);
        }
    }
    /**
     * Only admin can update staff accounts.
     * Authorization is also enforced in the controller via authorize().
     */
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        $userId = $this->route('staff')?->id;

        return [
            'name'           => 'sometimes|string|max:100',
            'contact_number' => 'sometimes|nullable|string|max:30',
            'email'      => [
                'sometimes',
                'nullable',
                'email',
                'max:150',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password'   => 'sometimes|nullable|string|min:8',
            'staff_type' => ['sometimes', Rule::in([User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])],
            'is_active'  => 'sometimes|boolean',
            'deactivation_reason' => 'sometimes|nullable|string|max:1000',
            'deletion_reason'     => 'sometimes|nullable|string|max:1000',
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique'  => 'This email is already used by another account.',
            'staff_type.in' => 'Staff type must be Front Desk or Groomer.',
        ];
    }
}
