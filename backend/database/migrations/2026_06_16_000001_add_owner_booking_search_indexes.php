<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $indexes = [
        'idx_owners_booking_display_id' => ['display_id'],
        'idx_owners_booking_first_last' => ['first_name', 'last_name'],
        'idx_owners_booking_email' => ['email'],
        'idx_owners_booking_phone' => ['phone'],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $name => $columns) {
            $this->createIndexIfMissing($name, $columns);
        }
    }

    public function down(): void
    {
        foreach (array_keys($this->indexes) as $name) {
            $this->dropIndexIfExists($name);
        }
    }

    private function createIndexIfMissing(string $name, array $columns): void
    {
        if ($this->indexExists($name)) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        $columnSql = $this->columnList($columns, $driver);

        if ($driver === 'pgsql' || $driver === 'sqlite') {
            DB::statement("CREATE INDEX {$name} ON owners ({$columnSql})");
            return;
        }

        DB::statement("ALTER TABLE owners ADD INDEX {$name} ({$columnSql})");
    }

    private function dropIndexIfExists(string $name): void
    {
        if (!$this->indexExists($name)) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql' || $driver === 'sqlite') {
            DB::statement("DROP INDEX {$name}");
            return;
        }

        DB::statement("ALTER TABLE owners DROP INDEX {$name}");
    }

    private function columnList(array $columns, string $driver): string
    {
        $quote = $driver === 'mysql' ? '`' : '"';
        return implode(', ', array_map(fn ($column) => $quote . $column . $quote, $columns));
    }

    private function indexExists(string $name): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            return count(DB::select('SHOW INDEX FROM owners WHERE Key_name = ?', [$name])) > 0;
        }

        if ($driver === 'sqlite') {
            return collect(DB::select('PRAGMA index_list(owners)'))
                ->contains(fn ($row) => ($row->name ?? null) === $name);
        }

        if ($driver === 'pgsql') {
            return count(DB::select('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?', ['owners', $name])) > 0;
        }

        return false;
    }
};
