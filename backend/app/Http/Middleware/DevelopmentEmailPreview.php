<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DevelopmentEmailPreview
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment(['local', 'testing'])) {
            return response()->json([
                'status' => 404,
                'message' => 'Not found.',
                'data' => null,
            ], 404);
        }

        return $next($request);
    }
}
