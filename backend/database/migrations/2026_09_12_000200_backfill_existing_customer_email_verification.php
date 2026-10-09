<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Customers created before email verification was enforced are
        // grandfathered in. New customer registrations still verify through
        // the registration OTP flow.
        DB::table('users')
            ->where('role', 'customer')
            ->whereNull('email_verified_at')
            ->update([
                'email_verified_at' => now('Asia/Manila'),
                'updated_at' => now('Asia/Manila'),
            ]);
    }

    public function down(): void
    {
        // Existing verification timestamps must not be removed on rollback.
    }
};
