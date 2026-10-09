<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StaffSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        // Maria Santos is the only seeded Front Desk employee.
        $frontDesk = [
            [
                'display_id' => 'DEMO2601',
                'name'       => 'Demo Front Desk',
                'email'      => 'demo.staff@example.invalid',
                'staff_type' => 'front_desk',
            ],
        ];

        foreach ($frontDesk as $row) {
            $user = User::withTrashed()->where('display_id', $row['display_id'])
                ->orWhere('email', $row['email'])
                ->first();

            if (! $user) {
                $user = new User();
            } elseif ($user->trashed()) {
                $user->restore();
            }

            $user->fill([
                'display_id'    => $row['display_id'],
                'name'          => $row['name'],
                'email'         => $row['email'],
                'password_hash' => Hash::make(Str::random(32)),
                'role'          => 'staff',
                'staff_type'    => 'front_desk',
                'is_active'     => true,
            ])->save();
        }

        // 2 retained Groomer staff — no system login required
        $groomers = [
            ['display_id' => 'DEMO2602', 'name' => 'Demo Groomer One', 'email' => null],
            ['display_id' => 'DEMO2603', 'name' => 'Demo Groomer Two', 'email' => null],
        ];

        foreach ($groomers as $row) {
            $user = User::withTrashed()->where('display_id', $row['display_id'])
                ->orWhere(function ($query) use ($row) {
                    $query->whereNull('email')->where('name', $row['name']);
                })
                ->first();

            if (! $user) {
                $user = new User();
            } elseif ($user->trashed()) {
                $user->restore();
            }

            $user->fill([
                'display_id'    => $row['display_id'],
                'name'          => $row['name'],
                'email'         => null,
                'password_hash' => Hash::make(Str::random(32)),
                'role'          => 'staff',
                'staff_type'    => 'groomer',
                'is_active'     => true,
            ])->save();
        }
    }
}
