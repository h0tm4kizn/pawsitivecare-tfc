<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBreedRequest;
use App\Http\Requests\UpdateBreedRequest;
use App\Models\Breed;
use App\Models\SpeciesType;

class BreedController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', Breed::class);
        $breeds = Breed::with('speciesType')->whereRaw('"is_active" = true')->get();
        return $this->success($breeds, 'Breeds retrieved successfully.');
    }

    // Cascading dropdown — GET /species/{speciesType}/breeds
    public function bySpecies(SpeciesType $speciesType)
    {
        $breeds = Breed::where('species_id', $speciesType->id)
            ->whereRaw('"is_active" = true')
            ->get();
        return $this->success($breeds, 'Breeds retrieved successfully.');
    }

    public function store(StoreBreedRequest $request)
    {
        $this->authorize('create', Breed::class);
        $breed = Breed::create($request->validated());
        return $this->success($breed, 'Breed created successfully.', 201);
    }

    public function show(Breed $breed)
    {
        $this->authorize('view', $breed);
        return $this->success($breed->load('speciesType'), 'Breed retrieved successfully.');
    }

    public function update(UpdateBreedRequest $request, Breed $breed)
    {
        $this->authorize('update', $breed);
        $breed->update($request->validated());
        return $this->success($breed, 'Breed updated successfully.');
    }

    public function destroy(Breed $breed)
    {
        $this->authorize('delete', $breed);
        $breed->delete();
        return $this->success(null, 'Breed deleted successfully.');
    }
}