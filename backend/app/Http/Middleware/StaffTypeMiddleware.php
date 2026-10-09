<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class StaffTypeMiddleware
{
    public function handle(Request $request, Closure $next, ...$allowedTypes)
    {
        $user = $request->user();
        if ($user?->isAdmin()) {
            return $next($request);
        }

        abort_unless($user?->isStaff() && in_array($user->normalizeStaffType($user->staff_type), $allowedTypes, true), 403);
        return $next($request);
    }
}
