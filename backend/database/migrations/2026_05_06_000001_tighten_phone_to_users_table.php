<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Step 1 — Tighten phone column to varchar(11) for canonical format enforcement.
     * Pre-migration cleanup: any phone not matching ^09[0-9]{9}$ is set to NULL
     * before the column type is narrowed. This prevents ALTER TYPE from failing
     * on legacy non-conforming data.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        // Null out phones that violate the canonical format before tightening.
        DB::statement("
            UPDATE users
            SET phone = NULL
            WHERE phone IS NOT NULL
              AND phone !~ '^09[0-9]{9}$'
        ");

        // Tighten phone to VARCHAR(11) — safe after cleanup above.
        DB::statement('ALTER TABLE users ALTER COLUMN phone TYPE varchar(11)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users ALTER COLUMN phone TYPE varchar(30)');
    }
};
