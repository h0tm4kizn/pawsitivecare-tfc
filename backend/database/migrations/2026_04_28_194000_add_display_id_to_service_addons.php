<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_addons', function (Blueprint $table) {
            if (!Schema::hasColumn('service_addons', 'display_id')) {
                $table->string('display_id', 20)->nullable()->unique();
            }
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_display_id_format_check');

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

    NEW.display_id := public.generate_smart_id_for_table('service_addons', 'display_id', prefix, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
SQL);

        DB::statement('DROP TRIGGER IF EXISTS trg_service_addons_set_display_id ON service_addons');
        DB::statement('CREATE TRIGGER trg_service_addons_set_display_id BEFORE INSERT ON service_addons FOR EACH ROW EXECUTE FUNCTION public.trg_service_addons_set_display_id()');

        DB::statement("
            UPDATE service_addons sa
            SET display_id = public.generate_smart_id_for_table(
                'service_addons',
                'display_id',
                CASE
                    WHEN lower(sa.category) = 'grooming_extra' THEN 'GAD'
                    WHEN lower(sa.category) = 'treatment' THEN 'TRT'
                    WHEN lower(sa.category) = 'daycare_upgrade' THEN 'DAD'
                    WHEN lower(sa.category) = 'hotel_grooming' THEN 'HAD'
                    ELSE NULL
                END,
                sa.created_at
            )
            WHERE (
                sa.display_id IS NULL
                OR sa.display_id !~ '^(GAD|TRT|DAD|HAD)[0-9]{6}$'
            )
            AND lower(sa.category) IN ('grooming_extra', 'treatment', 'daycare_upgrade', 'hotel_grooming')
        ");

        DB::statement("ALTER TABLE service_addons ADD CONSTRAINT service_addons_display_id_format_check CHECK (display_id IS NULL OR display_id ~ '^(GAD|TRT|DAD|HAD)[0-9]{6}$')");
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_service_addons_set_display_id ON service_addons');
        DB::statement('DROP FUNCTION IF EXISTS public.trg_service_addons_set_display_id()');
        DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_display_id_format_check');

        Schema::table('service_addons', function (Blueprint $table) {
            if (Schema::hasColumn('service_addons', 'display_id')) {
                DB::statement('ALTER TABLE service_addons DROP CONSTRAINT IF EXISTS service_addons_display_id_unique');
                $table->dropColumn('display_id');
            }
        });
    }
};
