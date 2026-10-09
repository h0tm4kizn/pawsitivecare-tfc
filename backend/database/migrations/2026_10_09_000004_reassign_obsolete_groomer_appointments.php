<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const TARGET_GROOMERS = [
        ['display_id' => 'STF2606', 'name' => 'Patrick Star'],
        ['display_id' => 'STF2607', 'name' => 'Gary Mendoza'],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $obsoleteIds = DB::table('users')
                ->where('role', 'staff')
                ->whereIn('display_id', ['STF2603', 'STF2604', 'STF2605'])
                ->whereIn('name', ['Ana Cruz', 'Ramon Dela Cruz', 'Lea Mendoza'])
                ->pluck('id');

            if ($obsoleteIds->isEmpty()) {
                return;
            }

            $targetIds = [];
            foreach (self::TARGET_GROOMERS as $target) {
                $existing = DB::table('users')
                    ->where('display_id', $target['display_id'])
                    ->first();

                if ($existing) {
                    $targetIds[] = $existing->id;
                    DB::table('users')
                        ->where('id', $existing->id)
                        ->update([
                            'name' => $target['name'],
                            'role' => 'staff',
                            'staff_type' => 'groomer',
                            'is_active' => true,
                            'deleted_at' => null,
                            'updated_at' => now(),
                        ]);
                    continue;
                }

                $id = (string) Str::uuid();
                DB::table('users')->insert([
                    'id' => $id,
                    'display_id' => $target['display_id'],
                    'name' => $target['name'],
                    'email' => null,
                    'password_hash' => Hash::make(Str::random(32)),
                    'role' => 'staff',
                    'staff_type' => 'groomer',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $targetIds[] = $id;
            }

            $eligible = DB::table('appointments')
                ->join('services', 'services.id', '=', 'appointments.service_id')
                ->where('services.category', 'grooming')
                ->whereNotNull('appointments.handled_by')
                ->whereIn('appointments.handled_by', $obsoleteIds->all())
                ->where('appointments.appointment_date', '<=', now('Asia/Manila')->toDateString())
                ->whereNotIn('appointments.status', ['cancelled', 'rejected'])
                ->orderBy('appointments.appointment_date')
                ->orderBy('appointments.id')
                ->select('appointments.id', 'appointments.handled_by')
                ->get();

            foreach ($eligible as $index => $appointment) {
                $targetId = $targetIds[$index % count($targetIds)];

                DB::table('appointments')
                    ->where('id', $appointment->id)
                    ->update([
                        'handled_by' => $targetId,
                        'updated_at' => now(),
                    ]);

                DB::table('staff_commissions')
                    ->where('appointment_id', $appointment->id)
                    ->where('staff_id', $appointment->handled_by)
                    ->update([
                        'staff_id' => $targetId,
                        'updated_at' => now(),
                    ]);
            }

            DB::table('users')
                ->whereIn('id', $obsoleteIds->all())
                ->update([
                    'is_active' => false,
                    'deleted_at' => now(),
                    'updated_at' => now(),
                ]);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('This historical reassignment migration is irreversible.');
    }
};
