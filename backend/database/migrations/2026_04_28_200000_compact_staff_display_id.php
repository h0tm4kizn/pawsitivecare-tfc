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
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_id_format_check');

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
CREATE OR REPLACE FUNCTION public.trg_users_set_display_id()
RETURNS trigger AS $$
DECLARE
    role_value text;
BEGIN
    IF NEW.display_id IS NOT NULL AND btrim(NEW.display_id) <> '' THEN
        RETURN NEW;
    END IF;

    role_value := lower(COALESCE(NEW.role, ''));

    IF role_value = 'staff' THEN
        NEW.display_id := public.generate_compact_id_for_table('users', 'display_id', 'STF', NEW.created_at, 2);
    ELSIF role_value = 'admin' THEN
        NEW.display_id := public.generate_smart_id_for_table('users', 'display_id', 'ADM', NEW.created_at);
    ELSE
        NEW.display_id := public.generate_smart_id_for_table('users', 'display_id', 'CX', NEW.created_at);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_users_set_display_id ON users');
        DB::statement('CREATE TRIGGER trg_users_set_display_id BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION public.trg_users_set_display_id()');

        DB::statement("
            WITH ranked_staff AS (
                SELECT
                    u.id,
                    to_char(COALESCE(u.created_at, now()), 'YY') AS yy,
                    row_number() OVER (
                        PARTITION BY to_char(COALESCE(u.created_at, now()), 'YY')
                        ORDER BY u.created_at, u.id
                    ) AS seq
                FROM users u
                WHERE lower(COALESCE(u.role, '')) = 'staff'
            )
            UPDATE users u
            SET display_id = 'STF' || ranked_staff.yy || lpad(ranked_staff.seq::text, 2, '0')
            FROM ranked_staff
            WHERE u.id = ranked_staff.id
        ");

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^STF[0-9]{4}$' OR display_id ~ '^(CX|ADM)[0-9]{6}$')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_id_format_check');

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

        DB::statement('DROP TRIGGER IF EXISTS trg_users_set_display_id ON users');
        DB::statement('CREATE TRIGGER trg_users_set_display_id BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION public.trg_users_set_display_id()');

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(CX|STF|ADM)[0-9]{6}$')");
    }
};
