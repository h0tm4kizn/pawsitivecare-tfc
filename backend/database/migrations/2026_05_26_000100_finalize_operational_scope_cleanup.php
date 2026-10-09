<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $legacyTables = [
            'payments',
            'billing_ledger',
            'billing_ledgers',
            'walk_in_sales',
            'walk_in_sale_items',
            'inventory_batches',
            'inventory_supplies',
            'inventory_transactions',
            'service_materials',
            'inventory',
            'master_items',
        ];

        if (DB::getDriverName() === 'sqlite') {
            foreach ($legacyTables as $table) {
                Schema::dropIfExists($table);
            }
            return;
        }

        foreach ($legacyTables as $table) {
            DB::statement("DROP TABLE IF EXISTS {$table} CASCADE");
        }

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF to_regclass('public.appointments') IS NOT NULL THEN
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_allowed_check;
        ALTER TABLE appointments DROP COLUMN IF EXISTS payment_status;
        ALTER TABLE appointments DROP COLUMN IF EXISTS mode_of_payment;
        ALTER TABLE appointments DROP COLUMN IF EXISTS bank_name;
        ALTER TABLE appointments DROP COLUMN IF EXISTS payment_date;
        DROP INDEX IF EXISTS idx_appointments_payment_status;
    END IF;
END $$;
SQL);

        DB::unprepared(<<<'SQL'
DO $$
BEGIN
    IF to_regclass('public.service_addons') IS NOT NULL THEN
        ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_inventory_item_id_foreign;
        ALTER TABLE service_addons DROP COLUMN IF EXISTS inventory_item_id;
    END IF;
END $$;
SQL);
    }

    public function down(): void
    {
        // Irreversible cleanup: POS/payment/inventory structures are intentionally removed.
    }
};
