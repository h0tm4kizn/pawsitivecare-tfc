<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BreedDataCleanupSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $speciesIds = DB::table('breeds')
                ->select('species_id')
                ->distinct()
                ->pluck('species_id');

            foreach ($speciesIds as $speciesId) {
                $otherId = DB::table('breeds')
                    ->where('species_id', $speciesId)
                    ->where(function ($query) {
                        $query->whereRaw('LOWER(name) = ?', ['other'])
                            ->orWhereRaw('LOWER(name) = ?', ['other (please specify)']);
                    })
                    ->value('id');

                if (! $otherId) {
                    $otherId = (string) Str::uuid();
                    DB::table('breeds')->insert([
                        'id' => $otherId,
                        'species_id' => $speciesId,
                        'name' => 'Other',
                        'is_active' => true,
                    ]);
                }

                $mixedIds = DB::table('breeds')
                    ->where('species_id', $speciesId)
                    ->whereRaw('LOWER(name) = ?', ['mixed'])
                    ->pluck('id');

                if ($mixedIds->count() > 0) {
                    DB::table('pets')
                        ->whereIn('breed_id', $mixedIds)
                        ->update(['breed_id' => $otherId]);

                    DB::table('breeds')
                        ->whereIn('id', $mixedIds)
                        ->delete();
                }
            }

            $rows = DB::table('breeds')
                ->select('id', 'species_id', 'name')
                ->orderBy('species_id')
                ->orderBy('id')
                ->get();

            $groups = [];
            foreach ($rows as $row) {
                $key = $row->species_id . '|' . mb_strtolower(trim((string) $row->name));
                $groups[$key][] = $row;
            }

            foreach ($groups as $group) {
                if (count($group) <= 1) {
                    continue;
                }

                $keep = $group[0];
                $dropIds = collect(array_slice($group, 1))->pluck('id');

                DB::table('pets')
                    ->whereIn('breed_id', $dropIds)
                    ->update(['breed_id' => $keep->id]);

                DB::table('breeds')
                    ->whereIn('id', $dropIds)
                    ->delete();
            }
        });
    }
}
