<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    /**
     * Return a standardized success response.
     * Used when an operation completes successfully.
     * All our controllers return this shape for consistency.
     */
    protected function success(
        mixed $data = null,
        string $message = 'Success',
        int $status = 200
    ): JsonResponse {
        return response()->json([
            'status'  => $status,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    /**
     * Return a standardized error response.
     * Used when something fails — validation, auth, not found, etc.
     * Keeps our error shape consistent across all endpoints.
     */
    protected function error(
        string $message = 'Error',
        int $status = 400,
        mixed $data = null
    ): JsonResponse {
        return response()->json([
            'status'  => $status,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }
}