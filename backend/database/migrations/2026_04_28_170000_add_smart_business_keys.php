<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('pets', 'pet_code') && !Schema::hasColumn('pets', 'pet_id')) {
            DB::statement('ALTER TABLE pets RENAME COLUMN pet_code TO pet_id');
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'display_id')) {
                $table->string('display_id', 16)->nullable()->unique();
            }
        });

        Schema::table('owners', function (Blueprint $table) {
            if (!Schema::hasColumn('owners', 'display_id')) {
                $table->string('display_id', 16)->nullable()->unique();
            }
        });

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS pets_pet_code_unique ON pets (pet_id) WHERE pet_id IS NOT NULL');

        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'appointment_code')) {
                $table->string('appointment_code', 16)->nullable()->unique();
            }
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_id_format_check");
        DB::statement("ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_display_id_format_check");
        DB::statement("ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_pet_code_format_check");
        DB::statement("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check");

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.generate_smart_id_for_table(
    p_table text,
    p_column text,
    p_prefix text,
    p_created_at timestamp
) RETURNS text AS $$
DECLARE
    yy text := to_char(COALESCE(p_created_at, now()), 'YY');
    next_seq integer;
    candidate text;
    sql_query text;
BEGIN
    sql_query := format(
        'SELECT COALESCE(MAX(RIGHT(%I, 4)::integer), 0) + 1 FROM %I WHERE %I IS NOT NULL AND %I ~ %L',
        p_column, p_table, p_column, p_column, '^' || p_prefix || yy || '[0-9]{4}$'
    );

    EXECUTE sql_query INTO next_seq;

    IF next_seq > 9999 THEN
        RAISE EXCEPTION 'Smart ID capacity exceeded for prefix % year %', p_prefix, yy;
    END IF;

    candidate := p_prefix || yy || lpad(next_seq::text, 4, '0');
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_users_set_display_id()
RETURNS trigger AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.display_id IS NOT NULL AND btrim(NEW.display_id) <> '' THEN
        RETURN NEW;
    END IF;

    prefix := CASE
        WHEN lower(COALESCE(NEW.role, '')) = 'admin' THEN 'ADM'
        WHEN lower(COALESCE(NEW.role, '')) = 'staff' THEN 'STF'
        ELSE 'CX'
    END;

    NEW.display_id := public.generate_smart_id_for_table('users', 'display_id', prefix, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_owners_set_display_id()
RETURNS trigger AS $$
BEGIN
    IF NEW.display_id IS NULL OR btrim(NEW.display_id) = '' THEN
        NEW.display_id := public.generate_smart_id_for_table('owners', 'display_id', 'CX', NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_pets_set_pet_code()
RETURNS trigger AS $$
DECLARE
    species_name text;
    prefix text;
BEGIN
    IF NEW.pet_id IS NOT NULL AND btrim(NEW.pet_id) <> '' THEN
        RETURN NEW;
    END IF;

    SELECT lower(name) INTO species_name FROM species_types WHERE id = NEW.species_id;
    prefix := CASE
        WHEN species_name = 'dog' THEN 'DOG'
        WHEN species_name = 'cat' THEN 'CAT'
        ELSE NULL
    END;

    IF prefix IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.pet_id := public.generate_smart_id_for_table('pets', 'pet_id', prefix, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.trg_appointments_set_appointment_code()
RETURNS trigger AS $$
DECLARE
    category text;
    prefix text;
BEGIN
    IF NEW.appointment_code IS NOT NULL AND btrim(NEW.appointment_code) <> '' THEN
        RETURN NEW;
    END IF;

    SELECT lower(category) INTO category FROM services WHERE id = NEW.service_id;
    prefix := CASE
        WHEN category = 'grooming' THEN 'G'
        WHEN category = 'hotel' THEN 'H'
        WHEN category = 'daycare' THEN 'DC'
        ELSE NULL
    END;

    IF prefix IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.appointment_code := public.generate_smart_id_for_table('appointments', 'appointment_code', prefix, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_users_set_display_id ON users');
        DB::statement('CREATE TRIGGER trg_users_set_display_id BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION public.trg_users_set_display_id()');

        DB::statement('DROP TRIGGER IF EXISTS trg_owners_set_display_id ON owners');
        DB::statement('CREATE TRIGGER trg_owners_set_display_id BEFORE INSERT ON owners FOR EACH ROW EXECUTE FUNCTION public.trg_owners_set_display_id()');

        DB::statement('DROP TRIGGER IF EXISTS trg_pets_set_pet_code ON pets');
        DB::statement('CREATE TRIGGER trg_pets_set_pet_code BEFORE INSERT ON pets FOR EACH ROW EXECUTE FUNCTION public.trg_pets_set_pet_code()');

        DB::statement('DROP TRIGGER IF EXISTS trg_appointments_set_appointment_code ON appointments');
        DB::statement('CREATE TRIGGER trg_appointments_set_appointment_code BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION public.trg_appointments_set_appointment_code()');

        DB::statement("
            UPDATE owners o
            SET display_id = public.generate_smart_id_for_table('owners', 'display_id', 'CX', o.created_at)
            WHERE o.display_id IS NULL
        ");

        DB::statement("
            UPDATE users u
            SET display_id = public.generate_smart_id_for_table(
                'users',
                'display_id',
                CASE
                    WHEN lower(COALESCE(u.role, '')) = 'admin' THEN 'ADM'
                    WHEN lower(COALESCE(u.role, '')) = 'staff' THEN 'STF'
                    ELSE 'CX'
                END,
                u.created_at
            )
            WHERE u.display_id IS NULL
        ");

        DB::statement("
            UPDATE pets p
            SET pet_id = public.generate_smart_id_for_table(
                'pets',
                'pet_id',
                CASE
                    WHEN lower(st.name) = 'dog' THEN 'DOG'
                    WHEN lower(st.name) = 'cat' THEN 'CAT'
                    ELSE NULL
                END,
                p.created_at
            )
            FROM species_types st
            WHERE st.id = p.species_id
              AND (p.pet_id IS NULL OR p.pet_id !~ '^(DOG|CAT)[0-9]{6}$')
              AND lower(st.name) IN ('dog', 'cat')
        ");

        DB::statement("
            UPDATE appointments a
            SET appointment_code = public.generate_smart_id_for_table(
                'appointments',
                'appointment_code',
                CASE
                    WHEN lower(s.category) = 'grooming' THEN 'G'
                    WHEN lower(s.category) = 'hotel' THEN 'H'
                    WHEN lower(s.category) = 'daycare' THEN 'DC'
                    ELSE NULL
                END,
                a.created_at
            )
            FROM services s
            WHERE s.id = a.service_id
              AND (a.appointment_code IS NULL OR a.appointment_code !~ '^(G|H|DC)[0-9]{6}$')
              AND lower(s.category) IN ('grooming', 'hotel', 'daycare')
        ");

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(CX|STF|ADM)[0-9]{6}$')");
        DB::statement("ALTER TABLE owners ADD CONSTRAINT owners_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^CX[0-9]{6}$')");
        DB::statement("ALTER TABLE pets ADD CONSTRAINT pets_pet_code_format_check CHECK (pet_id IS NULL OR pet_id ~ '^(DOG|CAT)[0-9]{6}$')");
        DB::statement("ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_code_format_check CHECK (appointment_code IS NULL OR appointment_code ~ '^(G|H|DC)[0-9]{6}$')");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_users_set_display_id ON users');
        DB::statement('DROP TRIGGER IF EXISTS trg_owners_set_display_id ON owners');
        DB::statement('DROP TRIGGER IF EXISTS trg_pets_set_pet_code ON pets');
        DB::statement('DROP TRIGGER IF EXISTS trg_appointments_set_appointment_code ON appointments');

        DB::statement('DROP FUNCTION IF EXISTS public.trg_users_set_display_id()');
        DB::statement('DROP FUNCTION IF EXISTS public.trg_owners_set_display_id()');
        DB::statement('DROP FUNCTION IF EXISTS public.trg_pets_set_pet_code()');
        DB::statement('DROP FUNCTION IF EXISTS public.trg_appointments_set_appointment_code()');
        DB::statement('DROP FUNCTION IF EXISTS public.generate_smart_id_for_table(text, text, text, timestamp)');

        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_id_format_check');
        DB::statement('ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_display_id_format_check');
        DB::statement('ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_pet_code_format_check');
        DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_format_check');
        DB::statement('DROP INDEX IF EXISTS pets_pet_code_unique');

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'display_id')) {
                DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_id_unique');
                $table->dropColumn('display_id');
            }
        });

        Schema::table('owners', function (Blueprint $table) {
            if (Schema::hasColumn('owners', 'display_id')) {
                DB::statement('ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_display_id_unique');
                $table->dropColumn('display_id');
            }
        });

        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'appointment_code')) {
                DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_appointment_code_unique');
                $table->dropColumn('appointment_code');
            }
        });
    }
};
