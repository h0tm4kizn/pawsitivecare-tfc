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
        'SELECT MIN(candidate_seq) FROM generate_series(1, %s) AS candidate_seq
         WHERE NOT EXISTS (
             SELECT 1 FROM %I
             WHERE %I = %L || %L || lpad(candidate_seq::text, %s, ''0'')
         )',
        power(10, p_digits) - 1,
        p_table,
        p_column,
        p_prefix,
        yy,
        p_digits
    );

    EXECUTE sql_query INTO next_seq;

    IF next_seq IS NULL THEN
        RAISE EXCEPTION 'Smart ID capacity exceeded for prefix % year %', p_prefix, yy;
    END IF;

    candidate := p_prefix || yy || lpad(next_seq::text, p_digits, '0');
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;
SQL);
    }

    public function down(): void
    {
        throw new RuntimeException('The lowest-available staff code generator cannot be safely reverted.');
    }
};
