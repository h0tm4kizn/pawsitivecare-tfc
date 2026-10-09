<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSpeciesTypeRequest;
use App\Http\Requests\UpdateSpeciesTypeRequest;
use App\Models\SpeciesType;

class SpeciesTypeController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', SpeciesType::class);
        $species = SpeciesType::whereRaw('"is_active" = true')->get();
        return $this->success($species, 'Species retrieved successfully.');
    }

    public function store(StoreSpeciesTypeRequest $request)
    {
        $this->authorize('create', SpeciesType::class);
        $data = $request->validated();
        $data['code'] = $this->generateUniqueCode($data['name']);
        $speciesType = SpeciesType::create($data);
        return $this->success($speciesType, 'Species created successfully.', 201);
    }

    private function generateUniqueCode(string $name): string
    {
        $base = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $name), 0, 1)) ?: 'X';
        $code = $base;
        $i = 0;
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        while (SpeciesType::where('code', $code)->exists()) {
            $code = $chars[$i % 26];
            $i++;
        }
        return $code;
    }

    public function show(SpeciesType $speciesType)
    {
        $this->authorize('view', $speciesType);
        return $this->success($speciesType, 'Species retrieved successfully.');
    }

    public function update(UpdateSpeciesTypeRequest $request, SpeciesType $speciesType)
    {
        $this->authorize('update', $speciesType);
        $speciesType->update($request->validated());
        return $this->success($speciesType, 'Species updated successfully.');
    }

    public function destroy(SpeciesType $speciesType)
    {
        $this->authorize('delete', $speciesType);
        $speciesType->delete();
        return $this->success(null, 'Species deleted successfully.');
    }
}