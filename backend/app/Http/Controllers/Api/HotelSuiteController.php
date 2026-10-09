<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\HotelSuite;
use App\Http\Requests\StoreHotelSuiteRequest;
use App\Http\Requests\UpdateHotelSuiteRequest;
use App\Services\HotelClusterAllocator;

class HotelSuiteController extends Controller
{
    public function __construct(private readonly HotelClusterAllocator $hotelAllocator)
    {
    }

    // 1. Validate request
    // 2. Authorize via policy
    // 3. Business logic (handled in service/model)

    /**
     * List available hotel suites (paginated).
     * GET /hotel-suites?page=1&per_page=20
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', HotelSuite::class);
        
        $perPage = min((int)$request->query('per_page', 20), 100);
        $suites = HotelSuite::whereRaw('"is_available" = true')
            ->orderedForDisplay()
            ->paginate($perPage);
        
        return $this->success($suites, 'Hotel suites retrieved successfully.');
    }
    
    /**
     * List all hotel suites with occupancy capacity context (paginated).
     * GET /admin/hotel-suites/occupancy?page=1&per_page=20
     */
    public function occupancy(Request $request)
    {
        $this->authorize('viewAny', HotelSuite::class);
        
        $perPage = min((int)$request->query('per_page', 20), 100);
        $suites = HotelSuite::orderedForDisplay()
            ->paginate($perPage);
        
        return $this->success($suites, 'Hotel suite occupancy capacity retrieved successfully.');
    }

    /**
     * Live occupancy snapshot by cluster.
     * GET /admin/hotel-suites/live-occupancy?date=YYYY-MM-DD&nights=1
     */
    public function liveOccupancy(Request $request)
    {
        $this->authorize('viewAny', HotelSuite::class);

        $validated = $request->validate([
            'date' => 'nullable|date',
            'nights' => 'nullable|integer|min:1|max:30',
            'owner_id' => 'nullable|uuid',
        ]);

        $date = $validated['date'] ?? now()->toDateString();
        $nights = (int)($validated['nights'] ?? 1);
        $snapshot = $this->hotelAllocator->currentOccupancySnapshot();
        $clusterBreakdown = [];
        $total = 0;
        foreach ($snapshot['clusters'] as $cluster) {
            $clusterBreakdown[] = $cluster;
            $total += (int)($cluster['capacity'] ?? 0);
        }

        return $this->success([
            'date' => $date,
            'nights' => $nights,
            'hotel_total' => $total,
            'hotel_occupied' => $snapshot['occupied'],
            'hotel_available' => max(0, $total - $snapshot['occupied']),
            'hotel_species_counts' => $snapshot['species_counts'],
            'hotel_dogs' => $snapshot['species_counts']['dog'],
            'hotel_cats' => $snapshot['species_counts']['cat'],
            'cluster_breakdown' => $clusterBreakdown,
            'capacity_settings' => $this->hotelAllocator->capacityMap(),
        ], 'Live hotel occupancy retrieved successfully.');
    }

    // Backward-compatible aliases for older clients.
    public function inventory(Request $request)
    {
        return $this->occupancy($request);
    }

    public function liveInventory(Request $request)
    {
        return $this->liveOccupancy($request);
    }

    public function store(StoreHotelSuiteRequest $request)
    {
        $this->authorize('create', HotelSuite::class);
        $suite = HotelSuite::create($request->validated());
        return $this->success($suite, 'Hotel suite created successfully.', 201);
    }

    public function show(HotelSuite $hotelSuite)
    {
        $this->authorize('view', $hotelSuite);
        return $this->success($hotelSuite, 'Hotel suite retrieved successfully.');
    }

    public function update(UpdateHotelSuiteRequest $request, HotelSuite $hotelSuite)
    {
        $this->authorize('update', $hotelSuite);
        $hotelSuite->update($request->validated());
        return $this->success($hotelSuite, 'Hotel suite updated successfully.');
    }

    public function destroy(HotelSuite $hotelSuite)
    {
        $this->authorize('delete', $hotelSuite);
        $hotelSuite->delete();
        return $this->success(null, 'Hotel suite deleted successfully.');
    }
}
