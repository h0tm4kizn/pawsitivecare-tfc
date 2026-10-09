<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check');

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_appointments_set_appointment_code()
RETURNS trigger AS $$
DECLARE
    yy text := to_char(COALESCE(NEW.created_at, now()), 'YY');
    next_seq integer;
BEGIN
    IF NEW.appointment_code IS NOT NULL AND btrim(NEW.appointment_code) <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(RIGHT(appointment_code, 4)::integer), 0) + 1
    INTO next_seq
    FROM appointments
    WHERE appointment_code ~ ('^APPT' || yy || '[0-9]{4}$');

    NEW.appointment_code := 'APPT' || yy || lpad(next_seq::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_appointments_set_appointment_code ON appointments');
        DB::statement('CREATE TRIGGER trg_appointments_set_appointment_code BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION public.trg_appointments_set_appointment_code()');

        // Backfill legacy/non-APPT appointment codes so existing rows satisfy the new format check.
        DB::statement("
            WITH ranked AS (
                SELECT
                    id,
                    to_char(COALESCE(created_at, now()), 'YY') AS yy,
                    row_number() OVER (
                        PARTITION BY to_char(COALESCE(created_at, now()), 'YY')
                        ORDER BY created_at, id
                    ) AS seq
                FROM appointments
                WHERE appointment_code IS NOT NULL
            )
            UPDATE appointments a
            SET appointment_code = 'APPT' || ranked.yy || lpad(ranked.seq::text, 4, '0')
            FROM ranked
            WHERE a.id = ranked.id
              AND a.appointment_code !~ '^APPT[0-9]{6}$'
        ");

        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_code_format_check CHECK (appointment_code IS NULL OR appointment_code ~ '^APPT[0-9]{6}$')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check');
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_code_format_check CHECK (appointment_code IS NULL OR appointment_code ~ '^(GPKG|HPKG|DCPKG)[0-9]{4}-[0-9]+$')");
    }
};
