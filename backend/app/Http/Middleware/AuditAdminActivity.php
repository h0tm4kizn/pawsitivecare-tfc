<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditAdminActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();
        $routeUri = $route?->uri() ?? $request->path();
        $before = $this->snapshots($route?->parameters() ?? []);
        $response = $next($request);

        $isTracked = in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            || ($request->method() === 'GET' && str_contains($routeUri, 'backup'));

        if ($isTracked && !str_contains($routeUri, 'audit-logs')) {
            try {
                $user = $request->user();
                AuditLog::create([
                    'user_id' => $user?->id,
                    'actor_name' => $user?->name,
                    'actor_email' => $user?->email,
                    'action' => $this->actionFor($request, $routeUri),
                    'method' => $request->method(),
                    'route' => '/' . ltrim($routeUri, '/'),
                    'status_code' => $response->getStatusCode(),
                    'ip_address' => $request->ip(),
                    'user_agent' => substr((string) $request->userAgent(), 0, 1000) ?: null,
                    'metadata' => array_filter([
                        'module' => $this->moduleFor($routeUri),
                        'description' => $this->descriptionFor($request, $routeUri, $route?->parameters() ?? [], $response),
                        'affected_record' => $this->affectedRecord($route?->parameters() ?? [], $request),
                        'changes' => $this->changes($before, $this->snapshots($route?->parameters() ?? []), $request),
                        'route_parameters' => collect($route?->parameters() ?? [])
                            ->map(fn ($value) => is_object($value) && method_exists($value, 'getKey') ? $value->getKey() : $value)
                            ->all(),
                    ], fn ($value) => $value !== null && $value !== []),
                ]);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $response;
    }

    private function actionFor(Request $request, string $route): string
    {
        if (str_contains($route, 'backup')) return 'backup';
        if (str_contains($route, 'restore')) return 'restore';
        if (str_contains($route, 'time-in')) return 'time_in';
        if (str_contains($route, 'correct-time-out')) return 'attendance_corrected';
        if (str_contains($route, 'time-out')) return 'time_out';
        if (str_contains($route, '/void')) return 'void';
        if (str_contains($route, '/status') && $request->input('status') === 'completed') return 'complete';
        if (str_contains($route, '/status') && $request->input('status') === 'cancelled') return 'cancel';
        if ($request->boolean('is_active') === false && $request->has('is_active')) return 'deactivate';
        return match ($request->method()) {
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'view',
        };
    }

    private function moduleFor(string $route): string
    {
        return match (true) {
            str_contains($route, 'attendance') => 'Attendance',
            str_contains($route, 'commission') => 'Commissions',
            str_contains($route, 'appointment') => 'Appointments',
            str_contains($route, 'owner') => 'Customers',
            str_contains($route, 'health-form') => 'Pet Assessments',
            str_contains($route, 'pet') => 'Pets',
            str_contains($route, 'promotion') => 'Promotions',
            str_contains($route, 'payment') => 'Payments',
            str_contains($route, 'walk-in-sales') => 'Walk-In Sales',
            str_contains($route, 'inventory') => 'Inventory',
            str_contains($route, 'service') => 'Services',
            str_contains($route, 'staff') || str_contains($route, 'users') => 'Staff',
            str_contains($route, 'backup') || str_contains($route, 'trashed') => 'Backup & Recovery',
            str_contains($route, 'settings') || str_contains($route, 'clinic') => 'Settings',
            default => 'System',
        };
    }

    private function snapshots(array $parameters): array
    {
        return collect($parameters)->filter(fn ($value) => is_object($value) && method_exists($value, 'getAttributes'))
            ->mapWithKeys(function ($model, $key) {
                $allowed = ['id', 'name', 'title', 'status', 'is_active', 'rate_percent', 'commission_rate', 'time_in_at', 'time_out_at', 'appointment_code', 'receipt_number', 'discount_percent', 'valid_until'];
                return [$key => collect($model->getAttributes())->only($allowed)->all()];
            })->all();
    }

    private function changes(array $before, array $after, Request $request): array
    {
        $changes = [];
        foreach ($before as $key => $old) {
            $new = $after[$key] ?? [];
            foreach (array_unique(array_merge(array_keys($old), array_keys($new))) as $field) {
                if (($old[$field] ?? null) !== ($new[$field] ?? null)) {
                    $changes[$field] = ['from' => $old[$field] ?? null, 'to' => $new[$field] ?? null];
                }
            }
        }
        foreach (['status', 'rate_percent', 'commission_rate', 'discount_percent', 'valid_until', 'time_in_at', 'time_out_at'] as $field) {
            if ($request->has($field) && !isset($changes[$field])) {
                $changes[$field] = ['to' => $request->input($field)];
            }
        }
        return $changes;
    }

    private function affectedRecord(array $parameters, Request $request): ?array
    {
        foreach ($parameters as $key => $value) {
            if (is_object($value) && method_exists($value, 'getKey')) {
                $attributes = method_exists($value, 'getAttributes') ? $value->getAttributes() : [];
                $label = $attributes['appointment_code'] ?? $attributes['receipt_number'] ?? $attributes['name'] ?? $attributes['title'] ?? $value->getKey();
                return ['type' => str_replace('_', ' ', ucfirst((string) $key)), 'id' => $value->getKey(), 'label' => (string) $label];
            }
        }
        $id = $request->input('appointment_id') ?? $request->input('staff_id');
        return $id ? ['id' => $id] : null;
    }

    private function descriptionFor(Request $request, string $route, array $parameters, Response $response): string
    {
        $record = $this->affectedRecord($parameters, $request);
        $label = $record['label'] ?? ($record['id'] ?? null);
        if (str_contains($route, 'time-in')) return 'Staff time in recorded' . ($label ? ": {$label}" : '');
        if (str_contains($route, 'correct-time-out')) {
            $staff = $parameters['staffAttendance']?->staff?->name;
            return 'Attendance corrected' . ($staff ? " for {$staff}" : '')
                . '. Time Out: ' . ($request->input('time_out_at') ?: '--')
                . '. Reason: ' . trim((string) $request->input('reason'));
        }
        if (str_contains($route, 'time-out')) return 'Staff time out recorded' . ($label ? ": {$label}" : '');
        if (str_contains($route, 'commission-settings')) return 'Default commission rate updated';
        if (str_contains($route, 'commissions')) return 'Commission record ' . ($request->isMethod('post') ? 'added' : 'updated') . ($label ? " for {$label}" : '');
        if (str_contains($route, 'backup')) return str_contains($route, 'restore') ? 'Database backup restored' : 'Database backup created';
        $module = $this->moduleFor($route);
        return ucfirst(strtolower($request->method())) . " {$module}" . ($label ? ": {$label}" : '');
    }
}
