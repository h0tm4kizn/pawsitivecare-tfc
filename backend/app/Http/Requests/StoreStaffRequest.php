<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\User;

class StoreStaffRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('staff_type')) {
            $this->merge(['staff_type' => User::normalizeStaffType($this->input('staff_type'))]);
        }
    }
    /**
     * Only admin can create staff accounts.
     * Authorization is also enforced in the controller via authorize().
     */
    public function authorize(): bool
    {
        return $this->user()->isAdmin();
    }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:100',
            'contact_number' => [
                Rule::requiredIf(fn () => $this->input('staff_type') === User::STAFF_TYPE_FRONT_DESK),
                'nullable',
                'string',
                'max:30',
            ],
            'email'      => [
                Rule::requiredIf(fn () => $this->input('staff_type') === User::STAFF_TYPE_FRONT_DESK),
                'nullable',
                'email',
                'max:150',
                'unique:users,email',
            ],
            'password'   => [
                Rule::requiredIf(fn () => $this->input('staff_type') === User::STAFF_TYPE_FRONT_DESK),
                'nullable',
                'string',
                'min:8',
            ],
            'staff_type' => ['required', Rule::in([User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])],
            'is_active'  => 'sometimes|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'         => 'Name is required.',
            'contact_number.required' => 'Contact number is required for Front Desk staff.',
            'email.required_if'     => 'Email is required for Front Desk staff.',
            'email.unique'          => 'This email is already registered.',
            'password.required_if'  => 'Password is required for Front Desk staff.',
            'staff_type.in'         => 'Staff type must be Front Desk or Groomer.',
        ];
    }
}
