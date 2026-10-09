<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            return;
        }

        User::updateOrCreate(
            ['email' => 'demo.admin@example.invalid'],
            [
                'name'          => 'Admin',
                'password_hash' => Hash::make(Str::random(32)),
                'role'          => 'admin',
                'is_active'     => true,
            ]
        );
    }
}
