<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Base FormRequest for routes restricted to admins and staff.
 * Extend this instead of FormRequest and omit authorize() — it's handled here.
 */
abstract class AdminStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() || $this->user()?->isStaff();
    }
}
