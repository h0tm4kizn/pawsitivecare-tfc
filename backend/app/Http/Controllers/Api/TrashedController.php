<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class TrashedController extends Controller
{
    private static function resolveModel(string $type): ?string
    {
        return match ($type) {
            'customers'    => \App\Models\Owner::class,
            'staff'        => \App\Models\User::class,
            'pets'         => \App\Models\Pet::class,
            'services'     => \App\Models\Service::class,
            'appointments' => \App\Models\Appointment::class,
            'inventory'    => \App\Models\Inventory::class,
            default        => null,
        };
    }

    public function index(string $type): JsonResponse
    {
        $model = self::resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        $query = $model::onlyTrashed();

        match ($type) {
            'pets'         => $query->with(['owner', 'speciesType']),
            'appointments' => $query->with(['pet', 'service']),
            'staff'        => $query->where('role', '!=', 'admin'),
            default        => null,
        };

        return response()->json([
            'data' => $query->orderByDesc('deleted_at')->get(),
        ]);
    }

    public function restore(string $type, string $id): JsonResponse
    {
        $model = self::resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        $record = $model::onlyTrashed()->findOrFail($id);
        $record->restore();

        return response()->json(['message' => 'Record restored successfully.']);
    }

    public function forceDelete(string $type, string $id): JsonResponse
    {
        $model = self::resolveModel($type);
        if (!$model) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        $record = $model::onlyTrashed()->findOrFail($id);
        $record->forceDelete();

        return response()->json(['message' => 'Record permanently deleted.']);
    }
}
