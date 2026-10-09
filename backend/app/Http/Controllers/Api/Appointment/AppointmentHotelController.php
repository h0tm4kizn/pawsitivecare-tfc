<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\User;
use App\Services\HotelExtensionService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AppointmentHotelController extends Controller
{
    public function __construct(
        private readonly HotelExtensionService $hotelExtensionService,
    )
    {
    }
    public function hotelCheckoutPreview(Request $request, Appointment $appointment)
    {
        $this->authorize('updateStatus', $appointment);
        $validated = $request->validate([
            'actual_check_out_at' => 'required|date',
            'actual_check_in_at' => 'nullable|date',
            'pet_size' => 'nullable|string|max:20',
        ]);
        $actual = Carbon::parse($validated['actual_check_out_at'], 'Asia/Manila');
        if ($actual->isFuture()) {
            return $this->error('Actual check-out cannot be in the future.', 422);
        }
        $checkIn = !empty($validated['actual_check_in_at'])
            ? Carbon::parse($validated['actual_check_in_at'], 'Asia/Manila')
            : $appointment->actual_check_in_at;
        if (!$checkIn || $checkIn->isFuture() || $actual->lessThanOrEqualTo($checkIn)) {
            return $this->error('Enter a valid actual check-in before checkout.', 422);
        }
        $appointment->loadMissing('service');
        if (!in_array($appointment->status, ['approved', 'in_progress'], true)
            || strtolower((string) $appointment->service?->category) !== 'hotel') {
            return $this->error('This Hotel Suite stay cannot be checked out.', 422);
        }
        return $this->success($this->hotelExtensionService->preview($appointment, $actual, $validated['pet_size'] ?? null));
    }

    public function hotelHandlerOptions(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = min(max($request->integer('per_page', 100), 1), 100);

        $query = User::query()
            ->where('role', 'staff')
            ->whereIn('staff_type', [User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])
            ->where('is_active', true)
            ->orderBy('name');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('name', 'like', '%' . $search . '%')
                    ->orWhere('display_id', 'like', '%' . $search . '%');
            });
        }

        return $this->success(
            $query->paginate($perPage, ['id', 'display_id', 'name', 'staff_type']),
            'Eligible Hotel Suite staff retrieved successfully.'
        );
    }

    /**
     * Limit appointment presentation for customers without changing stored data.
     */
}
