<?php

namespace App\Http\Requests;

class UpdateHotelSuiteRequest extends AdminStaffRequest
{
    public function rules(): array
    {
        $suiteId = $this->route('hotel_suite')?->id;
        return [
            'name' => 'sometimes|string|max:50|unique:hotel_suites,name,' . $suiteId,
            'code' => 'sometimes|string|max:10|unique:hotel_suites,code,' . $suiteId,
            'capacity' => 'sometimes|integer|min:1',
            'is_available' => 'sometimes|boolean',
        ];
    }
}
