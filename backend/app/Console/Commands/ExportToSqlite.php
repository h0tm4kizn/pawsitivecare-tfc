<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExportToSqlite extends Command
{
    protected $signature = 'db:export-sqlite {--force : Skip confirmation prompt}';
    protected $description = 'Snapshot Supabase (pgsql) → local SQLite for offline/demo use';

    // These tables are created with correct structure but left empty.
    // Ephemeral data (OTP sessions, queue jobs, cache) is useless offline
    // and sensitive data (password resets) should not be distributed in git.
    private array $emptyDataTables = [
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
        'login_otp_challenges',
        'registration_otp_challenges',
        'login_otp_events',
        'user_trusted_devices',
    ];

    // PostgreSQL data_type → SQLite affinity
    private array $typeMap = [
        'uuid'                        => 'TEXT',
        'text'                        => 'TEXT',
        'character varying'           => 'TEXT',
        'varchar'                     => 'TEXT',
        'char'                        => 'TEXT',
        'character'                   => 'TEXT',
        'name'                        => 'TEXT',
        'citext'                      => 'TEXT',
        'integer'                     => 'INTEGER',
        'int'                         => 'INTEGER',
        'int4'                        => 'INTEGER',
        'int2'                        => 'INTEGER',
        'smallint'                    => 'INTEGER',
        'bigint'                      => 'INTEGER',
        'int8'                        => 'INTEGER',
        'serial'                      => 'INTEGER',
        'bigserial'                   => 'INTEGER',
        'boolean'                     => 'INTEGER',
        'numeric'                     => 'REAL',
        'decimal'                     => 'REAL',
        'real'                        => 'REAL',
        'double precision'            => 'REAL',
        'float4'                      => 'REAL',
        'float8'                      => 'REAL',
        'jsonb'                       => 'TEXT',
        'json'                        => 'TEXT',
        'ARRAY'                       => 'TEXT',
        'timestamp without time zone' => 'TEXT',
        'timestamp with time zone'    => 'TEXT',
        'timestamp'                   => 'TEXT',
        'date'                        => 'TEXT',
        'time without time zone'      => 'TEXT',
        'time with time zone'         => 'TEXT',
        'time'                        => 'TEXT',
        'bytea'                       => 'BLOB',
        'USER-DEFINED'                => 'TEXT',  // enums
    ];

    public function handle(): int
    {
        $sqlitePath = database_path('database.sqlite');

        if (!$this->option('force') && !$this->confirm(
            'This will overwrite database/database.sqlite with a fresh snapshot from Supabase. Continue?'
        )) {
            return Command::SUCCESS;
        }

        // Verify pgsql is reachable before touching the SQLite file
        $this->line('Connecting to Supabase...');
        try {
            DB::connection('pgsql')->getPdo();
        } catch (\Exception $e) {
            $this->error('Cannot connect to Supabase: ' . $e->getMessage());
            $this->line('Make sure DB_CONNECTION=pgsql and credentials are correct in .env, then retry.');
            return Command::FAILURE;
        }
        $this->info('Connected.');

        // Ensure the SQLite file exists (touch creates it if missing)
        if (!file_exists($sqlitePath)) {
            touch($sqlitePath);
        }

        // Override the sqlite connection to always point at the standard path,
        // regardless of what DB_DATABASE is currently set to (it may be "postgres").
        config(['database.connections.sqlite.database' => $sqlitePath]);
        DB::purge('sqlite');

        $pg = DB::connection('pgsql');
        $sq = DB::connection('sqlite');

        // Speed up bulk inserts; disable FK checks during the load
        $sq->statement('PRAGMA journal_mode = WAL');
        $sq->statement('PRAGMA synchronous = NORMAL');
        $sq->statement('PRAGMA foreign_keys = OFF');

        // Discover every user table in the public schema
        $tables = collect($pg->select(
            "SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_type = 'BASE TABLE'
             ORDER BY table_name"
        ))->pluck('table_name');

        $this->newLine();
        $this->info("Found {$tables->count()} tables. Exporting...");
        $this->newLine();

        $bar = $this->output->createProgressBar($tables->count());
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%%  %message%');
        $bar->start();

        $totalRows = 0;
        $errors    = [];

        foreach ($tables as $table) {
            $bar->setMessage($table);

            try {
                // --- Schema: introspect from information_schema ---
                $columns = collect($pg->select(
                    "SELECT column_name, data_type, is_nullable, column_default
                     FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = ?
                     ORDER BY ordinal_position",
                    [$table]
                ));

                $colDefs = $columns->map(function ($c) {
                    $type = $this->typeMap[$c->data_type] ?? 'TEXT';
                    // PostgreSQL serial/bigserial columns have a nextval() default.
                    // In SQLite they must be INTEGER PRIMARY KEY so inserts auto-assign the id.
                    $isSerial = !empty($c->column_default)
                        && str_starts_with((string) $c->column_default, 'nextval(');
                    if ($isSerial) {
                        return "    \"{$c->column_name}\" INTEGER PRIMARY KEY";
                    }
                    $nullable = $c->is_nullable === 'NO' ? ' NOT NULL' : '';
                    return "    \"{$c->column_name}\" {$type}{$nullable}";
                })->join(",\n");

                $sq->statement("DROP TABLE IF EXISTS \"{$table}\"");
                $sq->statement("CREATE TABLE \"{$table}\" (\n{$colDefs}\n)");

                // --- Data: skip ephemeral/sensitive tables ---
                if (in_array($table, $this->emptyDataTables)) {
                    $bar->advance();
                    continue;
                }

                // Columns that need value coercion before SQLite insert
                $boolCols = $columns
                    ->filter(fn ($c) => $c->data_type === 'boolean')
                    ->pluck('column_name')
                    ->toArray();

                $jsonCols = $columns
                    ->filter(fn ($c) => in_array($c->data_type, ['json', 'jsonb', 'ARRAY']))
                    ->pluck('column_name')
                    ->toArray();

                $rows = $pg->table($table)->get();

                if ($rows->isNotEmpty()) {
                    $processed = $rows->map(function ($row) use ($boolCols, $jsonCols) {
                        $data = (array) $row;

                        foreach ($boolCols as $col) {
                            if (array_key_exists($col, $data) && $data[$col] !== null) {
                                // PDO may return 't'/'f' strings or PHP booleans
                                $data[$col] = ($data[$col] === true || $data[$col] === 't' || $data[$col] === '1' || $data[$col] === 1) ? 1 : 0;
                            }
                        }

                        foreach ($jsonCols as $col) {
                            if (array_key_exists($col, $data) && $data[$col] !== null && !is_string($data[$col])) {
                                $data[$col] = json_encode($data[$col]);
                            }
                        }

                        return $data;
                    });

                    // Batch inserts: 200 rows keeps SQLite well under its parameter limit
                    foreach ($processed->chunk(200) as $batch) {
                        $sq->table($table)->insert($batch->values()->toArray());
                    }

                    $totalRows += $rows->count();
                }
            } catch (\Exception $e) {
                $errors[] = "  {$table}: {$e->getMessage()}";
            }

            $bar->advance();
        }

        // Re-enable foreign key checks
        $sq->statement('PRAGMA foreign_keys = ON');

        $bar->finish();
        $this->newLine(2);

        if (!empty($errors)) {
            $this->warn('Some tables had errors:');
            foreach ($errors as $err) {
                $this->line($err);
            }
            $this->newLine();
        }

        $sizeKb = round(filesize($sqlitePath) / 1024, 1);
        $this->info("Done. {$totalRows} rows across {$tables->count()} tables — {$sizeKb} KB");
        $this->newLine();
        $this->line('  To use offline:  set <fg=cyan>DB_CONNECTION=sqlite</> in <fg=yellow>backend/.env</>');
        $this->line('  To go back online: set <fg=cyan>DB_CONNECTION=pgsql</> in <fg=yellow>backend/.env</>');
        $this->newLine();

        return empty($errors) ? Command::SUCCESS : Command::FAILURE;
    }
}
