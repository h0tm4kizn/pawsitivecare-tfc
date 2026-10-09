<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            if (!Schema::hasColumn('services', 'display_id')) {
                $table->string('display_id', 20)->nullable()->unique();
            }
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_display_id_format_check');

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

    NEW.display_id := public.generate_smart_id_for_table('services', 'display_id', prefix, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_services_set_display_id ON services');
        DB::statement('CREATE TRIGGER trg_services_set_display_id BEFORE INSERT ON services FOR EACH ROW EXECUTE FUNCTION public.trg_services_set_display_id()');

        DB::statement("
            UPDATE services s
            SET display_id = public.generate_smart_id_for_table(
                'services',
                'display_id',
                CASE
                    WHEN lower(s.category) = 'grooming' THEN 'GPKG'
                    WHEN lower(s.category) = 'hotel' THEN 'HPKG'
                    WHEN lower(s.category) = 'daycare' THEN 'DCPKG'
                    ELSE NULL
                END,
                s.created_at
            )
            WHERE (
                s.display_id IS NULL
                OR s.display_id !~ '^(GPKG|HPKG|DCPKG)[0-9]{6}$'
            )
            AND lower(s.category) IN ('grooming', 'hotel', 'daycare')
        ");

        DB::statement("ALTER TABLE services ADD CONSTRAINT services_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GPKG|HPKG|DCPKG)[0-9]{6}$')");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_services_set_display_id ON services');
        DB::statement('DROP FUNCTION IF EXISTS public.trg_services_set_display_id()');
        DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_display_id_format_check');

        Schema::table('services', function (Blueprint $table) {
            if (Schema::hasColumn('services', 'display_id')) {
                DB::statement('ALTER TABLE services DROP CONSTRAINT IF EXISTS services_display_id_unique');
                $table->dropColumn('display_id');
            }
        });
    }
};
