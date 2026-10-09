<?php

namespace App\Http\Controllers\Api\Appointment;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\HotelClusterAllocator;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class AppointmentDashboardController extends Controller
{
    public function __construct(
        private readonly HotelClusterAllocator $hotelAllocator,
    )
    {
    }

    private function visibleAppointments(Request $request)
    {
        $query = Appointment::query();
        if ($request->user()?->isGroomer()) {
            $query->where('handled_by', $request->user()->id)
                ->whereHas('service', fn ($q) => $q->where('category', 'grooming'));
        }
        return $query;
    }
    /**
    * Task 87b: Admin Dashboard Overview
    * GET /admin/dashboard/overview?date=
    * Returns grooming count, daycare slots, hotel availability, and approved check-ins.
    */
    public function dashboardOverview(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);

        $date = $request->query('date') ?? now('Asia/Manila')->toDateString();

        $groomingCount = $this->visibleAppointments($request)->whereDate('appointment_date', $date)
        ->whereHas('service', fn($q) => $q->where('category', 'grooming'))
        ->count();

        $daycareCount = $this->visibleAppointments($request)->whereDate('appointment_date', $date)
        ->whereHas('service', fn($q) => $q->where('category', 'daycare'))
        ->count();

        $hotelSnapshot = $this->hotelAllocator->currentOccupancySnapshot();
        $clusterBreakdown = $hotelSnapshot['clusters'];
        $hotelTotalSlots = array_sum(array_column($clusterBreakdown, 'capacity'));
        $hotelOccupied = $hotelSnapshot['occupied'];
        $hotelAvailable = max(0, $hotelTotalSlots - $hotelOccupied);
        $hotelSpeciesCounts = $hotelSnapshot['species_counts'];

        $inProgressCount = $this->visibleAppointments($request)->whereDate('appointment_date', $date)
        ->where('status', 'in_progress')
        ->count();

        return $this->success([
        'date'              => $date,
        'grooming_count'    => $groomingCount,
        'daycare_count'     => $daycareCount,
        'hotel_available'    => $hotelAvailable,
        'hotel_occupied'     => $hotelOccupied,
        'hotel_total'        => $hotelTotalSlots,
        'hotel_species_counts' => $hotelSpeciesCounts,
        'hotel_dogs'         => $hotelSpeciesCounts['dog'],
        'hotel_cats'         => $hotelSpeciesCounts['cat'],
        'cluster_breakdown'  => $clusterBreakdown,
        'in_progress_count' => $inProgressCount,
        ], 'Dashboard overview retrieved successfully.');
    }

    /**
    * Task 87c: Admin Dashboard Day
    * GET /admin/dashboard/day?date=
    * Returns timeline rows: pet, breed, service, staff, status.
    */
    public function dashboardDay(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);

        $date = $request->query('date') ?? now('Asia/Manila')->toDateString();

        $appointments = $this->visibleAppointments($request)->with([
        'pet.breed',
        'pet.owner',
        'service',
        'hotelSuite',
        'appointmentAddons.serviceAddon',
        'handledBy',
        'cancelledBy'
        ])
        ->whereDate('appointment_date', $date)
        ->orderBy('start_time')
        ->get()
        ->map(function ($appt) {
            return [
                'id'                  => $appt->id,
                'appointment_code'    => $appt->appointment_code,
                'status'              => $appt->status,
                'start_time'          => $appt->start_time,
                'appointment_date'    => $appt->appointment_date instanceof \Illuminate\Support\Carbon
                    ? $appt->appointment_date->toDateString()
                    : (string) $appt->appointment_date,
                'cancellation_reason' => $appt->cancellation_reason ?? null,
                'cancelled_at'        => $appt->cancelled_at ?? null,
                'cancelled_by'        => $appt->cancelledBy ? [
                    'id'         => $appt->cancelledBy->id,
                    'display_id' => $appt->cancelledBy->display_id,
                    'name'       => $appt->cancelledBy->name,
                ] : null,
                'cancellation_type'   => $appt->cancellation_type ?? null,
                'hotel_nights'        => $appt->hotel_nights,
                'pet'                 => $appt->pet ? [
                    'id'        => $appt->pet->id,
                    'pet_id'    => $appt->pet->pet_id,
                    'name'      => $appt->pet->name,
                    'photo_url' => $appt->pet->photo_url,
                    'breed'     => $appt->pet->breed ? [
                        'id'   => $appt->pet->breed->id,
                        'name' => $appt->pet->breed->name,
                    ] : null,
                    'owner' => $appt->pet->owner ? [
                        'display_id' => $appt->pet->owner->display_id,
                        'first_name' => $appt->pet->owner->first_name,
                        'last_name'  => $appt->pet->owner->last_name,
                        'phone'      => $appt->pet->owner->phone,
                        'email'      => $appt->pet->owner->email,
                        'address'    => $appt->pet->owner->address,
                    ] : null,
                ] : null,
                'service'    => $appt->service ? [
                    'id'         => $appt->service->id,
                    'display_id' => $appt->service->display_id,
                    'name'       => $appt->service->name,
                    'category'   => $appt->service->category,
                ] : null,
                'hotel_suite' => $appt->hotelSuite ? [
                    'id'   => $appt->hotelSuite->id,
                    'name' => $appt->hotelSuite->name,
                ] : null,
                'handled_by' => $appt->handledBy ? [
                    'id'   => $appt->handledBy->id,
                    'display_id' => $appt->handledBy->display_id,
                    'name' => $appt->handledBy->name,
                ] : null,
            ];
        });

        return $this->success([
        'date'        => $date,
        'appointments'=> $appointments,
        ], 'Dashboard day timeline retrieved successfully.');
    }

    /**
    * Task 87d: Admin Dashboard Week
    * GET /admin/dashboard/week?date=
    * Returns appointments grouped by day for the given week.
    */
    public function dashboardWeek(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);

        $startDate = \Carbon\Carbon::parse($request->query('date') ?? now('Asia/Manila'))->startOfWeek();
        $endDate   = $startDate->copy()->endOfWeek();

        $appointments = $this->visibleAppointments($request)->with(['pet.breed', 'pet.owner', 'service', 'handledBy', 'cancelledBy'])
        ->whereBetween('appointment_date', [$startDate, $endDate])
        ->orderBy('appointment_date')
        ->orderBy('start_time')
        ->get()
        ->map(function ($appt) {
            return [
                'id'                  => $appt->id,
                'appointment_code'    => $appt->appointment_code,
                'status'              => $appt->status,
                'start_time'          => $appt->start_time,
                'appointment_date'    => $appt->appointment_date->toDateString(),
                'cancellation_reason' => $appt->cancellation_reason ?? null,
                'cancelled_at'        => $appt->cancelled_at ?? null,
                'cancelled_by'        => $appt->cancelledBy ? [
                    'id'         => $appt->cancelledBy->id,
                    'display_id' => $appt->cancelledBy->display_id,
                    'name'       => $appt->cancelledBy->name,
                ] : null,
                'cancellation_type'   => $appt->cancellation_type ?? null,
                'pet'                 => $appt->pet ? [
                    'id'        => $appt->pet->id,
                    'pet_id'    => $appt->pet->pet_id,
                    'name'      => $appt->pet->name,
                    'photo_url' => $appt->pet->photo_url,
                    'breed'     => $appt->pet->breed ? ['id' => $appt->pet->breed->id, 'name' => $appt->pet->breed->name] : null,
                    'owner' => $appt->pet->owner ? [
                        'display_id' => $appt->pet->owner->display_id,
                        'first_name' => $appt->pet->owner->first_name,
                        'last_name'  => $appt->pet->owner->last_name,
                        'phone'      => $appt->pet->owner->phone,
                        'address'    => $appt->pet->owner->address,
                    ] : null,
                ] : null,
                'service'    => $appt->service ? ['id' => $appt->service->id, 'display_id' => $appt->service->display_id, 'name' => $appt->service->name, 'category' => $appt->service->category] : null,
                'handled_by' => $appt->handledBy ? ['id' => $appt->handledBy->id, 'name' => $appt->handledBy->name] : null,
            ];
        })
        ->groupBy('appointment_date');

        return $this->success([
        'week_start'   => $startDate->toDateString(),
        'week_end'     => $endDate->toDateString(),
        'appointments' => $appointments,
        ], 'Dashboard week view retrieved successfully.');
    }
 
    /**
    * Task 87e: Admin Dashboard List
    * GET /admin/dashboard/list?date=
    * Returns a flat list of appointments for the given date.
    */
    public function dashboardList(Request $request)
    {
        $this->authorize('viewAny', Appointment::class);

        $date = $request->query('date') ?? now('Asia/Manila')->toDateString();

        $appointments = $this->visibleAppointments($request)->with(['pet.breed', 'pet.owner', 'service', 'handledBy', 'cancelledBy'])
        ->whereDate('appointment_date', $date)
        ->orderBy('start_time')
        ->get()
        ->map(function ($appt) {
            return [
                'id'                  => $appt->id,
                'appointment_code'    => $appt->appointment_code,
                'status'              => $appt->status,
                'start_time'          => $appt->start_time,
                'cancellation_reason' => $appt->cancellation_reason ?? null,
                'cancelled_at'        => $appt->cancelled_at ?? null,
                'cancelled_by'        => $appt->cancelledBy ? [
                    'id'         => $appt->cancelledBy->id,
                    'display_id' => $appt->cancelledBy->display_id,
                    'name'       => $appt->cancelledBy->name,
                ] : null,
                'cancellation_type'   => $appt->cancellation_type ?? null,
                'pet'                 => $appt->pet ? [
                    'id'        => $appt->pet->id,
                    'pet_id'    => $appt->pet->pet_id,
                    'name'      => $appt->pet->name,
                    'photo_url' => $appt->pet->photo_url,
                    'breed'     => $appt->pet->breed ? ['id' => $appt->pet->breed->id, 'name' => $appt->pet->breed->name] : null,
                    'owner' => $appt->pet->owner ? [
                        'display_id' => $appt->pet->owner->display_id,
                        'first_name' => $appt->pet->owner->first_name,
                        'last_name'  => $appt->pet->owner->last_name,
                        'phone'      => $appt->pet->owner->phone,
                        'address'    => $appt->pet->owner->address,
                    ] : null,
                ] : null,
                'service'    => $appt->service ? ['id' => $appt->service->id, 'display_id' => $appt->service->display_id, 'name' => $appt->service->name, 'category' => $appt->service->category] : null,
                'handled_by' => $appt->handledBy ? ['id' => $appt->handledBy->id, 'name' => $appt->handledBy->name] : null,
            ];
        });

        return $this->success([
        'date'        => $date,
        'appointments'=> $appointments,
        ], 'Dashboard list view retrieved successfully.');
    }

    public function streamNewBookings(Request $request)
    {
        $token = (string) $request->query('token', '');
        if ($token === '') {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);
        $user = $accessToken?->tokenable;
        if (!$user || !($user->isAdmin() || ($user->isStaff() && $user->isFrontDeskStaff()))) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $sinceRaw = (string) $request->query('since', now('UTC')->subSeconds(15)->toIso8601String());
        try {
            $since = \Carbon\Carbon::parse($sinceRaw, 'UTC');
        } catch (\Throwable $e) {
            $since = now('UTC')->subSeconds(15);
        }

        return response()->stream(function () use ($since) {
            @ini_set('zlib.output_compression', '0');
            @ini_set('output_buffering', 'off');
            @ini_set('implicit_flush', '1');
            @set_time_limit(0);

            $cursor = $since->copy();

            // The Windows PHP development server handles one request at a time.
            // A long-lived SSE loop would block every dashboard request, so let
            // EventSource reconnect after one tick during local development.
            $maxTicks = PHP_SAPI === 'cli-server' ? 1 : 30;
            for ($tick = 0; $tick < $maxTicks; $tick++) {
                if (connection_aborted()) {
                    break;
                }

                $rows = Appointment::query()
                    ->with([
                        'service:id,name,category',
                        'pet:id,name,pet_id,owner_id',
                        'pet.owner:id,first_name,last_name',
                    ])
                    ->where('created_at', '>', $cursor)
                    ->whereIn(DB::raw('LOWER(COALESCE(status, \'\'))'), ['pending', 'approved'])
                    ->orderBy('created_at')
                    ->limit(20)
                    ->get();

                if ($rows->isNotEmpty()) {
                    $payload = $rows->map(function ($row) {
                        return [
                            'id' => $row->id,
                            'appointment_code' => $row->appointment_code,
                            'status' => $row->status,
                            'pet' => [
                                'name' => $row->pet?->name,
                                'pet_id' => $row->pet?->pet_id,
                            ],
                            'owner' => [
                                'first_name' => $row->pet?->owner?->first_name,
                                'last_name' => $row->pet?->owner?->last_name,
                            ],
                            'service' => [
                                'name' => $row->service?->name,
                                'category' => $row->service?->category,
                            ],
                            'created_at' => optional($row->created_at)->toIso8601String(),
                        ];
                    })->values();

                    $latest = $rows->last()?->created_at;
                    if ($latest) {
                        $cursor = $latest instanceof \Carbon\Carbon ? $latest : \Carbon\Carbon::parse($latest, 'UTC');
                    }

                    echo "event: booking\n";
                    echo 'data: ' . json_encode([
                        'appointments' => $payload,
                        'cursor' => $cursor->toIso8601String(),
                    ]) . "\n\n";
                } else {
                    echo "event: ping\n";
                    echo 'data: {"ok":true}' . "\n\n";
                }

                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
                sleep(1);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }


}
