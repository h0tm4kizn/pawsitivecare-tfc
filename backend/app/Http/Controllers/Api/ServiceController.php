<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Models\Service;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /**
     * Admin dashboard: return paginated services with tiers and appointment counts.
     * Supports optional ?category= filter and ?per_page=
     * GET /admin/services?page=1&per_page=20&category=grooming
     */
    public function adminIndex(Request $request)
    {
        $this->authorize('viewAny', Service::class);

        $query = Service::with('serviceTiers')
            ->withCount(['appointments' => function ($q) {
                $q->whereIn('status', ['approved', 'in_progress', 'completed']);
            }]);

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $perPage = min((int)$request->query('per_page', 20), 100);
        $paginated = $query->paginate($perPage);

        return $this->success(
            $paginated,
            'Services retrieved successfully.'
        );
    }

    /**
     * GET /services — public-facing active services list.
     * Supports optional ?category= filter.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Service::class);

        $query = Service::with('serviceTiers')->where('is_active', true);

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $services = $query->get();

        return $this->success($services, 'Services retrieved successfully.');
    }

    public function show(Service $service)
    {
        $this->authorize('view', $service);

        return $this->success(
        $service->load('serviceTiers'),
        'Service retrieved successfully.'
    );
    }

    /**
    * Task 83a: GET /services/{id}/detail
    * Returns full service record with tiers + addons
    */
    public function showDetail($id)
    {
        $this->authorize('view', Service::class);

        $service = Service::with(['serviceTiers', 'serviceAddons'])
        ->findOrFail($id);

        return $this->success(
        $service,
        'Service detail retrieved successfully.'
    );
    }

    public function store(StoreServiceRequest $request)
    {
        $this->authorize('create', Service::class);

        $service = Service::create($request->validated());

        return $this->success(
            $service->load('serviceTiers'),
            'Service created successfully.',
            201
        );
    }


    public function update(UpdateServiceRequest $request, Service $service)
    {
        $this->authorize('update', $service);

        $service->update($request->validated());

        return $this->success($service->load('serviceTiers'), 'Service updated successfully.');
    }

    public function destroy(Service $service)
    {
        $this->authorize('delete', $service);

        $service->delete();

        return $this->success(null, 'Service deleted successfully.');
    }
}
