<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Connection;
use Illuminate\Database\PostgresConnection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $identifier = strtolower(trim((string) $request->input('identifier', 'unknown')));

            return [
                Limit::perMinute(20)->by('login-ip:' . $request->ip()),
                Limit::perMinute(8)->by('login-account:' . hash('sha256', $identifier . '|' . $request->ip())),
            ];
        });

        RateLimiter::for('forgot-password', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email', 'unknown')));

            return [
                Limit::perMinute(10)->by('forgot-ip:' . $request->ip()),
                Limit::perMinute(5)->by('forgot-account:' . hash('sha256', $email . '|' . $request->ip())),
            ];
        });

        RateLimiter::for('scan-create', fn (Request $request) => Limit::perMinute(10)->by('scan-create:' . $request->user()->id));
        RateLimiter::for('scan-session', fn (Request $request) => Limit::perMinute(60)->by('scan-session:' . $request->ip() . ':' . hash('sha256', (string) $request->route('token'))));

        if (app()->environment('production')) {
            URL::forceScheme('https');
        }

        // SQLite local mode: apply PRAGMAs once at boot for much faster reads/writes.
        // WAL allows concurrent reads, large cache avoids disk I/O, mmap keeps the DB in memory.
        if (DB::getDefaultConnection() === 'sqlite') {
            DB::statement('PRAGMA journal_mode = WAL');
            DB::statement('PRAGMA synchronous  = NORMAL');
            DB::statement('PRAGMA cache_size    = -64000');  // 64 MB page cache
            DB::statement('PRAGMA temp_store    = MEMORY');
            DB::statement('PRAGMA mmap_size     = 268435456'); // 256 MB memory-map
        }

        DB::beforeExecuting(function (string &$query, array &$bindings, Connection $connection) {
            if ($connection instanceof PostgresConnection) {
                foreach ($bindings as $key => $value) {
                    if (is_bool($value)) {
                        $bindings[$key] = $value ? 'true' : 'false';
                    }
                }
            }
        });
    }
}
