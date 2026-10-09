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
        DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_display_id_format_check');
        DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_display_id_format_check');
        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check');

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.generate_compact_id_for_table(
    p_table text,
    p_column text,
    p_prefix text,
    p_created_at timestamp,
    p_digits integer DEFAULT 2
) RETURNS text AS $$
DECLARE
    yy text := to_char(COALESCE(p_created_at, now()), 'YY');
    next_seq integer;
    candidate text;
    sql_query text;
BEGIN
    sql_query := format(
        'SELECT COALESCE(MAX(RIGHT(%I, %s)::integer), 0) + 1 FROM %I WHERE %I IS NOT NULL AND %I ~ %L',
        p_column, p_digits, p_table, p_column, p_column, '^' || p_prefix || yy || '[0-9]{' || p_digits || '}$'
    );

    EXECUTE sql_query INTO next_seq;

    IF next_seq > (power(10, p_digits) - 1) THEN
        RAISE EXCEPTION 'Smart ID capacity exceeded for prefix % year %', p_prefix, yy;
    END IF;

    candidate := p_prefix || yy || lpad(next_seq::text, p_digits, '0');
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_services_set_display_id()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.display_id IS NOT NULL AND btrim(NEW.display_id) <> '' THEN
        RETURN NEW;
    END IF;

    prefix := CASE
        WHEN lower(COALESCE(NEW.category, '')) = 'grooming' THEN 'GPKG'
        WHEN lower(COALESCE(NEW.category, '')) = 'hotel' THEN 'HPKG'
        WHEN lower(COALESCE(NEW.category, '')) = 'daycare' THEN 'DCPKG'
        ELSE NULL
    END;

    IF prefix IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.display_id := public.generate_compact_id_for_table('services', 'display_id', prefix, NEW.created_at, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_services_set_display_id ON services');
        DB::statement('CREATE TRIGGER trg_services_set_display_id BEFORE INSERT ON services FOR EACH ROW EXECUTE FUNCTION public.trg_services_set_display_id()');

        DB::statement("
            WITH normalized AS (
                SELECT
                    s.id,
                    CASE
                        WHEN lower(s.category) = 'grooming' THEN 'GPKG'
                        WHEN lower(s.category) = 'hotel' THEN 'HPKG'
                        WHEN lower(s.category) = 'daycare' THEN 'DCPKG'
                        ELSE NULL
                    END AS prefix,
                    row_number() OVER (
                        PARTITION BY
                            CASE
                                WHEN lower(s.category) = 'grooming' THEN 'GPKG'
                                WHEN lower(s.category) = 'hotel' THEN 'HPKG'
                                WHEN lower(s.category) = 'daycare' THEN 'DCPKG'
                                ELSE NULL
                            END,
                            to_char(COALESCE(s.created_at, now()), 'YY')
                        ORDER BY s.created_at, s.id
                    ) AS seq,
                    to_char(COALESCE(s.created_at, now()), 'YY') AS yy
                FROM services s
                WHERE lower(s.category) IN ('grooming', 'hotel', 'daycare')
            )
            UPDATE services s
            SET display_id = normalized.prefix || normalized.yy || lpad(normalized.seq::text, 2, '0')
            FROM normalized
            WHERE s.id = normalized.id
              AND normalized.prefix IS NOT NULL
        ");

        DB::statement("ALTER TABLE services ADD CONSTRAINT services_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GPKG|HPKG|DCPKG)[0-9]{4}$')");

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_service_addons_set_display_id()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.display_id IS NOT NULL AND btrim(NEW.display_id) <> '' THEN
        RETURN NEW;
    END IF;

    prefix := CASE
        WHEN lower(COALESCE(NEW.category, '')) = 'grooming_extra' THEN 'GAD'
        WHEN lower(COALESCE(NEW.category, '')) = 'treatment' THEN 'TRT'
        WHEN lower(COALESCE(NEW.category, '')) = 'daycare_upgrade' THEN 'DAD'
        WHEN lower(COALESCE(NEW.category, '')) = 'hotel_grooming' THEN 'HAD'
        ELSE NULL
    END;

    IF prefix IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.display_id := public.generate_compact_id_for_table('service_addons', 'display_id', prefix, NEW.created_at, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_service_addons_set_display_id ON service_addons');
        DB::statement('CREATE TRIGGER trg_service_addons_set_display_id BEFORE INSERT ON service_addons FOR EACH ROW EXECUTE FUNCTION public.trg_service_addons_set_display_id()');

        DB::statement("
            WITH normalized AS (
                SELECT
                    sa.id,
                    CASE
                        WHEN lower(sa.category) = 'grooming_extra' THEN 'GAD'
                        WHEN lower(sa.category) = 'treatment' THEN 'TRT'
                        WHEN lower(sa.category) = 'daycare_upgrade' THEN 'DAD'
                        WHEN lower(sa.category) = 'hotel_grooming' THEN 'HAD'
                        ELSE NULL
                    END AS prefix,
                    row_number() OVER (
                        PARTITION BY
                            CASE
                                WHEN lower(sa.category) = 'grooming_extra' THEN 'GAD'
                                WHEN lower(sa.category) = 'treatment' THEN 'TRT'
                                WHEN lower(sa.category) = 'daycare_upgrade' THEN 'DAD'
                                WHEN lower(sa.category) = 'hotel_grooming' THEN 'HAD'
                                ELSE NULL
                            END,
                            to_char(COALESCE(sa.created_at, now()), 'YY')
                        ORDER BY sa.created_at, sa.id
                    ) AS seq,
                    to_char(COALESCE(sa.created_at, now()), 'YY') AS yy
                FROM service_addons sa
                WHERE lower(sa.category) IN ('grooming_extra', 'treatment', 'daycare_upgrade', 'hotel_grooming')
            )
            UPDATE service_addons sa
            SET display_id = normalized.prefix || normalized.yy || lpad(normalized.seq::text, 2, '0')
            FROM normalized
            WHERE sa.id = normalized.id
              AND normalized.prefix IS NOT NULL
        ");

        DB::statement("ALTER TABLE service_addons ADD CONSTRAINT service_addons_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GAD|TRT|DAD|HAD)[0-9]{4}$')");

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_appointments_set_appointment_code()
RETURNS trigger AS $$
DECLARE
    base_display_id text;
    next_seq integer;
BEGIN
    IF NEW.appointment_code IS NOT NULL AND btrim(NEW.appointment_code) <> '' THEN
        RETURN NEW;
    END IF;

    SELECT display_id INTO base_display_id
    FROM services
    WHERE id = NEW.service_id;

    IF base_display_id IS NULL OR btrim(base_display_id) = '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(split_part(appointment_code, '-', 2)::integer), 0) + 1
    INTO next_seq
    FROM appointments
    WHERE appointment_code ~ ('^' || base_display_id || '-[0-9]+$');

    NEW.appointment_code := base_display_id || '-' || next_seq::text;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_appointments_set_appointment_code ON appointments');
        DB::statement('CREATE TRIGGER trg_appointments_set_appointment_code BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION public.trg_appointments_set_appointment_code()');

        DB::statement("
            WITH ranked AS (
                SELECT
                    a.id,
                    s.display_id AS base_display_id,
                    row_number() OVER (
                        PARTITION BY s.display_id
                        ORDER BY a.created_at, a.id
                    ) AS seq
                FROM appointments a
                JOIN services s ON s.id = a.service_id
                WHERE s.display_id IS NOT NULL
            )
            UPDATE appointments a
            SET appointment_code = ranked.base_display_id || '-' || ranked.seq::text
            FROM ranked
            WHERE a.id = ranked.id
        ");

        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_code_format_check CHECK (appointment_code IS NULL OR appointment_code ~ '^(GPKG|HPKG|DCPKG)[0-9]{4}-[0-9]+$')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_display_id_format_check');
        DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_display_id_format_check');
        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check');

        DB::statement("ALTER TABLE services ADD CONSTRAINT services_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GPKG|HPKG|DCPKG)[0-9]{6}$')");
        DB::statement("ALTER TABLE service_addons ADD CONSTRAINT service_addons_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GAD|TRT|DAD|HAD)[0-9]{6}$')");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_code_format_check CHECK (appointment_code IS NULL OR appointment_code ~ '^(G|H|DC)[0-9]{6}$')");
    }
};
