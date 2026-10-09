<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ScanSessionController extends Controller
{
    private const TTL = 120;

    public function serverIp()
    {
        $lanIp = null;

        // Method 1: PHP 8.3+ net_get_interfaces
        if (! $lanIp && function_exists('net_get_interfaces')) {
            foreach (net_get_interfaces() as $interface) {
                foreach ($interface['unicast'] ?? [] as $addr) {
                    if ($this->isLanIp($addr['address'] ?? '')) {
                        $lanIp = $addr['address'];
                        break 2;
                    }
                }
            }
        }

        // Method 2: Windows — parse ipconfig output
        if (! $lanIp && \PHP_OS_FAMILY === 'Windows' && function_exists('shell_exec')) {
            $output = @shell_exec('ipconfig');
            if ($output && preg_match_all('/IPv4 Address[^:]*:\s*([\d.]+)/i', $output, $m)) {
                foreach ($m[1] as $ip) {
                    if ($this->isLanIp($ip)) { $lanIp = $ip; break; }
                }
            }
        }

        // Method 3: Linux/Mac — hostname -I or ip addr
        if (! $lanIp && \PHP_OS_FAMILY !== 'Windows' && function_exists('shell_exec')) {
            $output = @shell_exec('hostname -I 2>/dev/null');
            if ($output) {
                foreach (explode(' ', trim($output)) as $ip) {
                    if ($this->isLanIp($ip)) { $lanIp = $ip; break; }
                }
            }
        }

        // Method 4: hostname resolution fallback
        if (! $lanIp) {
            $resolved = gethostbyname(gethostname());
            if ($this->isLanIp($resolved)) {
                $lanIp = $resolved;
            }
        }

        return response()->json(['ip' => $lanIp]);
    }

    private function isLanIp(string $ip): bool
    {
        return str_starts_with($ip, '192.168.')
            || str_starts_with($ip, '10.')
            || (bool) preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $ip);
    }

    public function create(Request $request)
    {
        $token = Str::random(64);
        $cacheKey = $this->cacheKey($token);
        Cache::put($cacheKey, [
            'status'  => 'waiting',
            'barcode' => null,
            'created_by' => (string) $request->user()->id,
            'created_at' => now()->toISOString(),
        ], self::TTL);

        return response()->json(['token' => $token]);
    }

    public function submit(Request $request, string $token)
    {
        $validated = $request->validate(['barcode' => 'required|string|max:255']);

        $cacheKey = $this->cacheKey($token);
        $session = Cache::get($cacheKey);
        if (! $session) {
            return response()->json(['message' => 'Session expired or invalid.'], 404);
        }

        if (($session['status'] ?? null) !== 'waiting') {
            return response()->json(['message' => 'Session has already been completed.'], 409);
        }

        // A cache lock prevents two phone requests from both completing the
        // same session during a race.
        $completed = Cache::lock("{$cacheKey}:lock", 5)->block(1, function () use ($cacheKey, $session, $validated) {
            $current = Cache::get($cacheKey);
            if (! $current || ($current['status'] ?? null) !== 'waiting') {
                return false;
            }

            Cache::put($cacheKey, [
                'status'  => 'scanned',
                'barcode' => $validated['barcode'],
                'created_by' => $current['created_by'] ?? null,
                'created_at' => $current['created_at'] ?? null,
            ], self::TTL);
            return true;
        });

        if (! $completed) {
            return response()->json(['message' => 'Session has already been completed.'], 409);
        }

        return response()->json(['message' => 'Barcode received.']);
    }

    public function poll(string $token)
    {
        $cacheKey = $this->cacheKey($token);
        $session = Cache::get($cacheKey);
        if (! $session) {
            return response()->json(['status' => 'expired']);
        }

        if (($session['status'] ?? null) !== 'scanned') {
            return response()->json(['status' => 'waiting', 'barcode' => null]);
        }

        // The desktop receives the result once. Subsequent polls cannot replay
        // or overwrite the completed scan.
        $result = Cache::lock("{$cacheKey}:lock", 5)->block(1, function () use ($cacheKey) {
            $current = Cache::get($cacheKey);
            if (! $current || ($current['status'] ?? null) !== 'scanned') {
                return null;
            }

            Cache::put($cacheKey, [
                'status' => 'consumed',
                'barcode' => null,
                'created_by' => $current['created_by'] ?? null,
                'created_at' => $current['created_at'] ?? null,
            ], 10);

            return $current['barcode'] ?? null;
        });

        if ($result === null) {
            return response()->json(['status' => 'consumed']);
        }

        return response()->json(['status' => 'scanned', 'barcode' => $result]);
    }

    private function cacheKey(string $token): string
    {
        return 'scan:' . hash('sha256', $token);
    }
}
