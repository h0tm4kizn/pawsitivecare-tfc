<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    private const BACKUP_DIR = 'backups';

    private array $excludedTables = [
        'cache',
        'cache_locks',
        'failed_jobs',
        'jobs',
        'job_batches',
        'migrations',
        'password_reset_tokens',
        'personal_access_tokens',
        'sessions',
    ];

    private function backupDisk()
    {
        return Storage::disk(config('filesystems.backup_disk', 'local'));
    }

    public function export(): StreamedResponse
    {
        $tables = $this->backupTables();
        $rows = [];
        $columns = [];

        foreach ($tables as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $tableRows = DB::table($table)->get()->map(fn ($row) => (array) $row)->toArray();

            foreach ($tableRows as $row) {
                foreach (array_keys($row) as $column) {
                    if (!in_array($column, $columns, true)) {
                        $columns[] = $column;
                    }
                }

                $rows[] = [
                    'table' => $table,
                    'data' => $row,
                ];
            }
        }

        $filename = 'pawsitivecare-backup-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(
            function () use ($rows, $columns) {
                $output = fopen('php://output', 'w');
                fputcsv($output, ['table', ...$columns]);

                foreach ($rows as $row) {
                    $csvRow = [$row['table']];
                    foreach ($columns as $column) {
                        $value = $row['data'][$column] ?? '';
                        $csvRow[] = is_scalar($value) || $value === null
                            ? $value
                            : json_encode($value, JSON_UNESCAPED_UNICODE);
                    }
                    fputcsv($output, $csvRow);
                }

                fclose($output);
            },
            $filename,
            ['Content-Type' => 'text/csv; charset=UTF-8'],
        );
    }

    public function index(): JsonResponse
    {
        $disk = $this->backupDisk();
        $disk->makeDirectory(self::BACKUP_DIR);

        $files = collect($disk->files(self::BACKUP_DIR))
            ->filter(fn ($path) => Str::endsWith($path, ['.json', '.csv']))
            ->map(fn ($path) => $this->backupFileMeta($path))
            ->sortByDesc('created_at')
            ->values();

        return response()->json(['data' => $files]);
    }

    public function create(Request $request): JsonResponse
    {
        $format = strtolower((string) $request->input('format', 'json'));
        if (!in_array($format, ['json', 'csv'], true)) {
            return response()->json(['message' => 'Backup format must be JSON or CSV.'], 422);
        }

        $disk = $this->backupDisk();
        $disk->makeDirectory(self::BACKUP_DIR);

        if ($format === 'csv') {
            $filename = 'pawsitivecare-db-backup-' . now()->format('Y-m-d-His') . '.csv';
            $path = self::BACKUP_DIR . '/' . $filename;
            $disk->put($path, $this->csvContents());

            return response()->json([
                'message' => 'CSV backup created.',
                'data' => $this->backupFileMeta($path),
            ], 201);
        }

        $payload = [
            'format' => 'pawsitivecare.database-backup',
            'version' => 1,
            'backup_type' => 'full',
            'backup_scope' => 'all operational database records from first record through backup creation time',
            'created_at' => now()->toISOString(),
            'connection' => config('database.default'),
            'table_count' => 0,
            'row_count' => 0,
            'tables' => [],
        ];

        foreach ($this->backupTables() as $table) {
            $rows = DB::table($table)->orderBy($this->orderColumn($table))->get()
                ->map(fn ($row) => (array) $row)
                ->values()
                ->all();
            $payload['tables'][$table] = $rows;
            $payload['table_count']++;
            $payload['row_count'] += count($rows);
        }

        $filename = 'pawsitivecare-db-backup-' . now()->format('Y-m-d-His') . '.json';
        $path = self::BACKUP_DIR . '/' . $filename;
        $disk->put($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return response()->json([
            'message' => 'Database backup created.',
            'data' => $this->backupFileMeta($path),
        ], 201);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'backup' => ['required', 'file', 'mimes:json,txt,csv', 'max:51200'],
        ]);

        $file = $request->file('backup');
        $contents = file_get_contents($file->getRealPath());
        $extension = strtolower($file->getClientOriginalExtension());

        if ($extension === 'csv') {
            $disk = $this->backupDisk();
            $disk->makeDirectory(self::BACKUP_DIR);
            $safeOriginal = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
            $filename = ($safeOriginal ?: 'uploaded-backup') . '-' . now()->format('Y-m-d-His') . '.csv';
            $path = self::BACKUP_DIR . '/' . $filename;
            $disk->put($path, $contents);

            return response()->json([
                'message' => 'CSV file uploaded.',
                'data' => $this->backupFileMeta($path),
            ], 201);
        }

        $payload = json_decode($contents, true);

        if (!$this->isValidBackupPayload($payload)) {
            return response()->json(['message' => 'The uploaded file is not a valid PawsitiveCare database backup.'], 422);
        }

        $disk = $this->backupDisk();
        $disk->makeDirectory(self::BACKUP_DIR);
        $safeOriginal = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $filename = ($safeOriginal ?: 'uploaded-backup') . '-' . now()->format('Y-m-d-His') . '.json';
        $path = self::BACKUP_DIR . '/' . $filename;
        $disk->put($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return response()->json([
            'message' => 'Backup uploaded.',
            'data' => $this->backupFileMeta($path),
        ], 201);
    }

    public function download(string $filename): StreamedResponse|JsonResponse
    {
        $path = $this->resolveBackupPath($filename);
        if (!$path) {
            return response()->json(['message' => 'Backup not found.'], 404);
        }

        $disk = $this->backupDisk();

        return response()->streamDownload(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            if (!is_resource($stream)) {
                return;
            }

            fpassthru($stream);
            fclose($stream);
        }, basename($path), ['Content-Type' => 'application/json']);
    }

    public function restore(string $filename): JsonResponse
    {
        if (!Str::endsWith(strtolower(rawurldecode($filename)), '.json')) {
            return response()->json(['message' => 'Only JSON backups can be restored.'], 422);
        }

        $path = $this->resolveBackupPath($filename);
        if (!$path) {
            return response()->json(['message' => 'Backup not found.'], 404);
        }

        $payload = json_decode($this->backupDisk()->get($path), true);
        if (!$this->isValidBackupPayload($payload)) {
            return response()->json(['message' => 'Backup file is invalid.'], 422);
        }

        $tables = $this->backupTables();
        $payloadTables = $payload['tables'] ?? [];

        DB::transaction(function () use ($tables, $payloadTables) {
            $driver = DB::getDriverName();

            foreach (array_reverse($tables) as $table) {
                if (!array_key_exists($table, $payloadTables)) {
                    continue;
                }

                if ($driver === 'pgsql') {
                    DB::statement('TRUNCATE TABLE ' . $this->quoteIdentifier($table) . ' RESTART IDENTITY CASCADE');
                } elseif ($driver === 'mysql') {
                    DB::statement('SET FOREIGN_KEY_CHECKS=0');
                    DB::table($table)->truncate();
                    DB::statement('SET FOREIGN_KEY_CHECKS=1');
                } else {
                    DB::table($table)->delete();
                }
            }

            foreach ($tables as $table) {
                $rows = $payloadTables[$table] ?? null;
                if (!is_array($rows) || count($rows) === 0) {
                    continue;
                }

                collect($rows)->chunk(500)->each(function ($chunk) use ($table) {
                    DB::table($table)->insert($chunk->map(fn ($row) => (array) $row)->all());
                });

                $this->syncPostgresSequence($table, $rows);
            }
        });

        return response()->json(['message' => 'Database restored successfully.']);
    }

    private function backupTables(): array
    {
        $tables = collect($this->databaseTables())
            ->reject(fn ($table) => in_array($table, $this->excludedTables, true))
            ->values()
            ->all();

        return $this->sortTablesByDependencies($tables);
    }

    private function databaseTables(): array
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            return collect(DB::select("
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                  and table_type = 'BASE TABLE'
                order by table_name
            "))->pluck('table_name')->all();
        }

        if ($driver === 'sqlite') {
            return collect(DB::select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"))
                ->pluck('name')
                ->all();
        }

        return collect(DB::select('show tables'))
            ->map(fn ($row) => array_values((array) $row)[0] ?? null)
            ->filter()
            ->values()
            ->all();
    }

    private function orderColumn(string $table): string
    {
        return Schema::hasColumn($table, 'id') ? 'id' : Schema::getColumnListing($table)[0] ?? 'created_at';
    }

    private function sortTablesByDependencies(array $tables): array
    {
        $tables = array_values(array_unique($tables));
        $tableSet = array_flip($tables);
        $dependencies = collect($tables)->mapWithKeys(fn ($table) => [$table => []])->all();

        foreach ($this->foreignKeyDependencies($tables) as $edge) {
            $child = $edge['child'] ?? null;
            $parent = $edge['parent'] ?? null;
            if (!$child || !$parent || $child === $parent || !isset($tableSet[$child], $tableSet[$parent])) {
                continue;
            }
            $dependencies[$child][] = $parent;
        }

        $ordered = [];
        while (count($dependencies) > 0) {
            $ready = collect($dependencies)
                ->filter(fn ($parents) => count(array_diff($parents, $ordered)) === 0)
                ->keys()
                ->values()
                ->all();

            if (count($ready) === 0) {
                return array_values(array_unique([...$ordered, ...array_keys($dependencies)]));
            }

            foreach ($ready as $table) {
                $ordered[] = $table;
                unset($dependencies[$table]);
            }
        }

        return $ordered;
    }

    private function foreignKeyDependencies(array $tables): array
    {
        if (count($tables) === 0) {
            return [];
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            return collect(DB::select("
                select
                    tc.table_name as child,
                    ccu.table_name as parent
                from information_schema.table_constraints tc
                join information_schema.key_column_usage kcu
                    on tc.constraint_name = kcu.constraint_name
                   and tc.table_schema = kcu.table_schema
                join information_schema.constraint_column_usage ccu
                    on ccu.constraint_name = tc.constraint_name
                   and ccu.table_schema = tc.table_schema
                where tc.constraint_type = 'FOREIGN KEY'
                  and tc.table_schema = 'public'
            "))->map(fn ($row) => ['child' => $row->child, 'parent' => $row->parent])->all();
        }

        if ($driver === 'mysql') {
            $database = config('database.connections.mysql.database');
            return collect(DB::select("
                select table_name as child, referenced_table_name as parent
                from information_schema.key_column_usage
                where table_schema = ?
                  and referenced_table_name is not null
            ", [$database]))->map(fn ($row) => ['child' => $row->child, 'parent' => $row->parent])->all();
        }

        return [];
    }

    private function isValidBackupPayload(mixed $payload): bool
    {
        return is_array($payload)
            && ($payload['format'] ?? null) === 'pawsitivecare.database-backup'
            && isset($payload['tables'])
            && is_array($payload['tables']);
    }

    private function csvContents(): string
    {
        $output = fopen('php://temp', 'r+');
        $columns = [];
        $rows = [];

        foreach ($this->backupTables() as $table) {
            $tableRows = DB::table($table)->orderBy($this->orderColumn($table))->get()
                ->map(fn ($row) => (array) $row)
                ->all();

            foreach ($tableRows as $row) {
                foreach (array_keys($row) as $column) {
                    if (!in_array($column, $columns, true)) {
                        $columns[] = $column;
                    }
                }
                $rows[] = ['table' => $table, 'data' => $row];
            }
        }

        fputcsv($output, ['table', ...$columns]);
        foreach ($rows as $row) {
            $csvRow = [$row['table']];
            foreach ($columns as $column) {
                $value = $row['data'][$column] ?? '';
                $csvRow[] = is_scalar($value) || $value === null
                    ? $value
                    : json_encode($value, JSON_UNESCAPED_UNICODE);
            }
            fputcsv($output, $csvRow);
        }

        rewind($output);
        $contents = stream_get_contents($output);
        fclose($output);
        return $contents;
    }

    private function backupFileMeta(string $path): array
    {
        $filename = basename($path);
        $disk = $this->backupDisk();
        $modified = $disk->lastModified($path);
        $size = $disk->size($path);

        return [
            'filename' => $filename,
            'format' => strtolower(pathinfo($filename, PATHINFO_EXTENSION)),
            'size' => $size,
            'size_label' => $this->formatBytes($size),
            'created_at' => date(DATE_ATOM, $modified),
            'download_url' => '/api/admin/backup/files/' . rawurlencode($filename) . '/download',
        ];
    }

    private function resolveBackupPath(string $filename): ?string
    {
        $clean = basename(rawurldecode($filename));
        if (!$clean || !Str::endsWith(strtolower($clean), ['.json', '.csv'])) {
            return null;
        }

        $path = self::BACKUP_DIR . '/' . $clean;
        return $this->backupDisk()->exists($path) ? $path : null;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '"' . str_replace('"', '""', $identifier) . '"';
    }

    private function syncPostgresSequence(string $table, array $rows): void
    {
        if (DB::getDriverName() !== 'pgsql' || !Schema::hasColumn($table, 'id')) {
            return;
        }

        $maxId = collect($rows)->max(fn ($row) => is_numeric($row['id'] ?? null) ? (int) $row['id'] : 0);
        if (!$maxId) {
            return;
        }

        $sequence = DB::selectOne("select pg_get_serial_sequence('public." . str_replace("'", "''", $table) . "', 'id') as sequence_name");
        if (!$sequence?->sequence_name) {
            return;
        }

        DB::statement("select setval(?, ?, true)", [$sequence->sequence_name, $maxId]);
    }
}
