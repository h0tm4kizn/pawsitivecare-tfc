<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerEmailVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Admins and staff retain their existing access rules. Only customer
        // accounts created through email registration require verification.
        if ($user?->isCustomer() && !$user->email_verified_at) {
            return response()->json([
                'status' => 403,
                'message' => 'Please verify your email before accessing your account.',
                'data' => ['requires_verification' => true],
            ], 403);
        }

        return $next($request);
    }
}
