<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        App\Console\Commands\NormalizePetIds::class,
    ])
    ->withMiddleware(function (Middleware $middleware) {
        // Avoid route('login') lookup for API requests; unauthenticated API calls should return 401 JSON.
        $middleware->redirectGuestsTo(function (Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return null;
            }

            return '/login';
        });

        // Register our custom RoleMiddleware with the alias 'role'
        // This allows us to use middleware('role:admin') in our routes
        // instead of the full class name every time
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'staff_type' => \App\Http\Middleware\StaffTypeMiddleware::class,
            'audit.admin' => \App\Http\Middleware\AuditAdminActivity::class,
            'development.email.preview' => \App\Http\Middleware\DevelopmentEmailPreview::class,
            'verified.customer' => \App\Http\Middleware\EnsureCustomerEmailVerified::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // 401 — No token or expired token
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'status'  => 401,
                    'message' => 'Unauthenticated.',
                    'data'    => null,
                ], 401);
            }
        });

        // 403 — Authenticated but not authorized (policy blocked)
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'status'  => 403,
                    'message' => 'Forbidden. You do not have access to this resource.',
                    'data'    => null,
                ], 403);
            }
        });

        // 404 — Model not found via route model binding
        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'status'  => 404,
                    'message' => 'Resource not found.',
                    'data'    => null,
                ], 404);
            }
        });

        // 404 — Route not found
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'status'  => 404,
                    'message' => 'Route not found.',
                    'data'    => null,
                ], 404);
            }
        });
    })->create();
