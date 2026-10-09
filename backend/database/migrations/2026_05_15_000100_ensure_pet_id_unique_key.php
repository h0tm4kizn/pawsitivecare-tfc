<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pets') || !Schema::hasColumn('pets', 'pet_id')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS pets_pet_id_unique ON pets (pet_id) WHERE pet_id IS NOT NULL');
            return;
        }

        Schema::table('pets', function (Blueprint $table) {
            $table->unique('pet_id', 'pets_pet_id_unique');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pets')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS pets_pet_id_unique');
            return;
        }

        Schema::table('pets', function (Blueprint $table) {
            $table->dropUnique('pets_pet_id_unique');
        });
    }
};
