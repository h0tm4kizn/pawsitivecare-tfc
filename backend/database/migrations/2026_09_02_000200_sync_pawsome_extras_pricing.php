<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            ['name' => 'Tooth Brush', 'min' => 100, 'max' => 120, 'aliases' => ['Toothbrush']],
            ['name' => 'Nail Trim', 'min' => 100, 'max' => 120],
            ['name' => 'Ear Cleaning', 'min' => 100, 'max' => 120],
            ['name' => 'Face Trim', 'min' => 150, 'max' => null],
            ['name' => 'Poodle Feet', 'min' => 150, 'max' => null],
            ['name' => 'Anal Sac', 'min' => 150, 'max' => null],
            ['name' => 'Paw Shave', 'min' => 150, 'max' => 250],
            ['name' => 'Sanitary Shave', 'min' => 150, 'max' => 250],
            ['name' => 'Round Face', 'min' => 150, 'max' => 250],
            ['name' => 'Dematting - S', 'min' => 200, 'max' => null],
            ['name' => 'Dematting - M', 'min' => 300, 'max' => null],
            ['name' => 'Dematting - L', 'min' => 400, 'max' => null],
            ['name' => 'Dematting - XL', 'min' => 500, 'max' => null],
            ['name' => 'Medicated Bath - S', 'min' => 150, 'max' => null, 'aliases' => ['Medicated Bath']],
            ['name' => 'Medicated Bath - M', 'min' => 250, 'max' => null],
            ['name' => 'Medicated Bath - L', 'min' => 350, 'max' => null],
            ['name' => 'Organic Bath - S', 'min' => 250, 'max' => null, 'aliases' => ['Organic Bath']],
            ['name' => 'Organic Bath - M', 'min' => 350, 'max' => null],
            ['name' => 'Whitening - S', 'min' => 250, 'max' => null, 'aliases' => ['Whitening', 'Whitening Bath']],
            ['name' => 'Whitening - M', 'min' => 350, 'max' => null],
        ];

        foreach ($rows as $row) {
            $aliases = $row['aliases'] ?? [];
            $addon = DB::table('service_addons')->where('name', $row['name'])->first();

            if (! $addon && $aliases !== []) {
                $addon = DB::table('service_addons')->whereIn('name', $aliases)->first();
            }

            $isSized = (bool) preg_match('/\s-\s(?:S|M|L|XL|XXL)$/i', $row['name']);
            $values = [
                'name' => $row['name'],
                'category' => 'grooming_extra',
                'price_min' => $row['min'],
                'price_max' => $row['max'],
                'has_size_pricing' => $isSized,
                'is_active' => true,
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('service_addons', 'applies_to_grooming')) {
                $values['applies_to_grooming'] = true;
                $values['applies_to_daycare'] = false;
                $values['applies_to_hotel'] = false;
            }

            if ($addon) {
                DB::table('service_addons')->where('id', $addon->id)->update($values);
            } else {
                DB::table('service_addons')->insert(array_merge($values, [
                    'id' => (string) Str::uuid(),
                    'created_at' => now(),
                ]));
            }

            if ($aliases !== []) {
                $staleAliasQuery = DB::table('service_addons')
                    ->whereIn('name', $aliases)
                    ->where('id', '!=', $addon?->id ?? '');
                $aliasUpdates = ['is_active' => false, 'updated_at' => now()];
                if (Schema::hasColumn('service_addons', 'deactivation_reason')) {
                    $aliasUpdates['deactivation_reason'] = 'Replaced by size-specific pricing.';
                }
                $staleAliasQuery->update($aliasUpdates);
            }
        }
    }

    public function down(): void
    {
        // Pricing corrections are intentionally retained to protect appointment history.
    }
};
