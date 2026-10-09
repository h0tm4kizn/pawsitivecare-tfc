<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PatchSqliteSerials extends Command
{
    protected $signature = 'db:patch-sqlite';
    protected $description = 'Fix INTEGER PRIMARY KEY columns in the local SQLite snapshot (run once after first export)';

    public function handle(): int
    {
        $sqlitePath = database_path('database.sqlite');

        if (!file_exists($sqlitePath)) {
            $this->error('No SQLite file found at ' . $sqlitePath);
            return Command::FAILURE;
        }

        config(['database.connections.sqlite.database' => $sqlitePath]);
        DB::purge('sqlite');
        $sq = DB::connection('sqlite');

        // Find tables where "id" was exported as INTEGER NOT NULL instead of INTEGER PRIMARY KEY.
        // SQLite stores the original CREATE TABLE SQL in sqlite_master.
        $tables = collect($sq->select(
            "SELECT name, sql FROM sqlite_master
             WHERE type = 'table'
               AND sql LIKE '%\"id\" INTEGER NOT NULL%'"
        ));

        if ($tables->isEmpty()) {
            $this->info('Nothing to patch -- all serial columns look correct.');
            return Command::SUCCESS;
        }

        $this->info("Found {$tables->count()} table(s) to patch:");
        $sq->statement('PRAGMA foreign_keys = OFF');

        foreach ($tables as $tbl) {
            $this->line("  Patching: {$tbl->name}");

            // Replace INTEGER NOT NULL with INTEGER PRIMARY KEY for the id column only
            $newSql = preg_replace(
                '/("id"\s+INTEGER)\s+NOT NULL/',
                '$1 PRIMARY KEY',
                (string) $tbl->sql
            );

            if ($newSql === $tbl->sql) {
                $this->line("    Skipped (pattern not matched).");
                continue;
            }

            try {
                // Rename the broken table, recreate it correctly, copy data, drop old
                $sq->statement("ALTER TABLE \"{$tbl->name}\" RENAME TO \"_patch_old_{$tbl->name}\"");
                $sq->statement($newSql);

                $rows = $sq->table("_patch_old_{$tbl->name}")->get();
                if ($rows->isNotEmpty()) {
                    foreach ($rows->chunk(200) as $batch) {
                        $sq->table($tbl->name)->insert(
                            $batch->map(fn ($r) => (array) $r)->values()->toArray()
                        );
                    }
                }

                $sq->statement("DROP TABLE \"_patch_old_{$tbl->name}\"");
                $this->line("    Done ({$rows->count()} rows preserved).");
            } catch (\Exception $e) {
                $this->error("    Failed: {$e->getMessage()}");
                // Try to restore the original name if something went wrong
                try {
                    $sq->statement("ALTER TABLE \"_patch_old_{$tbl->name}\" RENAME TO \"{$tbl->name}\"");
                } catch (\Throwable) {}
            }
        }

        $sq->statement('PRAGMA foreign_keys = ON');

        $this->newLine();
        $this->info('Patch complete. You can now log in offline.');

        return Command::SUCCESS;
    }
}
