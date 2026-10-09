<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceCategoryController extends Controller
{
    /** GET /api/service-categories — list all active categories */
    public function index()
    {
        $cats = ServiceCategory::where('is_active', true)
            ->orderBy('created_at')
            ->get();

        return response()->json(['categories' => $cats]);
    }

    /** POST /api/admin/service-categories — create a new category (admin only) */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100|unique:service_categories,name',
            'color' => 'sometimes|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ], [
            'name.unique' => 'A service category with this name already exists.',
            'color.regex' => 'Color must be a valid hex code (e.g. #4DB6AC).',
        ]);

        $slug = Str::slug($data['name'], '_');

        // Ensure slug is unique
        $base = $slug;
        $n    = 1;
        while (ServiceCategory::where('slug', $slug)->exists()) {
            $slug = $base . '_' . $n++;
        }

        $cat = ServiceCategory::create([
            'name'      => $data['name'],
            'slug'      => $slug,
            'color'     => $data['color'] ?? '#4DB6AC',
            'is_active' => true,
        ]);

        return response()->json(['category' => $cat], 201);
    }

    /** PUT /api/admin/service-categories/{serviceCategory} */
    public function update(Request $request, ServiceCategory $serviceCategory)
    {
        $data = $request->validate([
            'name'  => 'required|string|max:100|unique:service_categories,name,' . $serviceCategory->id,
            'color' => 'sometimes|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ], [
            'name.unique' => 'A service category with this name already exists.',
            'color.regex' => 'Color must be a valid hex code (e.g. #4DB6AC).',
        ]);

        $serviceCategory->update([
            'name'  => $data['name'],
            'color' => $data['color'] ?? $serviceCategory->color,
        ]);

        return response()->json(['category' => $serviceCategory->fresh()]);
    }

    /** DELETE /api/admin/service-categories/{serviceCategory} */
    public function destroy(ServiceCategory $serviceCategory)
    {
        $serviceCategory->delete();
        return response()->json(['message' => 'Category deleted.']);
    }
}
