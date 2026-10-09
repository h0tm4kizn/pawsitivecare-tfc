<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * This middleware checks if the authenticated user has one of
     * the allowed roles before letting them into the route group.
     *
     * Usage in routes: middleware(['auth:sanctum', 'role:admin,staff'])
     * The roles after the colon are passed as $roles parameter below.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Get the currently authenticated user
        $user = $request->user();

        // If no user is authenticated, return 401
        // (this is a safety net — auth:sanctum should catch this first)
        if (!$user) {
            return response()->json([
                'status'  => 401,
                'message' => 'Unauthenticated.',
                'data'    => null,
            ], 401);
        }

        // Normalize role checks to avoid false 403 from casing/spacing drift.
        $userRole = strtolower(trim((string) $user->role));
        $allowedRoles = array_map(
            static fn (string $role) => strtolower(trim($role)),
            $roles
        );

        // Staff compatibility: rely on User::isStaff() so all canonical and
        // legacy team roles are handled in one place.
        $isTeamStaff = method_exists($user, 'isStaff') && $user->isStaff();

        $hasAllowedRole = in_array($userRole, $allowedRoles, true)
            || ($isTeamStaff && in_array('staff', $allowedRoles, true));

        // Check if the user's role is in our allowed roles list
        // e.g. role:admin,staff → $roles = ['admin', 'staff']
        if (!$hasAllowedRole) {
            return response()->json([
                'status'  => 403,
                'message' => 'Forbidden. You do not have access to this resource.',
                'data'    => null,
            ], 403);
        }

        // Role is valid — let the request through
        return $next($request);
    }
}
