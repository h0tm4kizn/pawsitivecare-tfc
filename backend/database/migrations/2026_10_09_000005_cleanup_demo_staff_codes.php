<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $cleanupNames = ['Jose Reyes', 'Ana Cruz', 'Ramon Dela Cruz', 'Lea Mendoza'];
            $updates = [
                'display_id' => null,
                'is_active' => false,
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('users', 'deleted_at')) {
                $updates['deleted_at'] = now();
            }

            DB::table('users')
                ->where('role', 'staff')
                ->where(function ($query) use ($cleanupNames) {
                    $query->whereIn('name', $cleanupNames)
                        ->orWhereIn('display_id', ['STF2604', 'STF2605', 'STF2606', 'STF2607']);
                })
                ->where(function ($query) {
                    $query->where('email', 'like', '%@demo.test')
                        ->orWhere('email', 'like', '%@example.test');
                })
                ->update($updates);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('This demo staff cleanup migration is irreversible.');
    }
};
