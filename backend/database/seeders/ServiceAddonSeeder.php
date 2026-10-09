<?php

namespace Database\Seeders;

use App\Models\ServiceAddon;
use Illuminate\Database\Seeder;

class ServiceAddonSeeder extends Seeder
{
    /**
     * Seed global service add-ons.
     * service_addons has no service_id; add-ons are global and filtered by category in UI.
     */
    public function run(): void
    {
        $rows = [
            ['name' => 'Tooth Brush',           'category' => 'grooming_extra', 'price_min' => 100.00, 'price_max' => 120.00, 'aliases' => []],
            ['name' => 'Nail Trim',             'category' => 'grooming_extra', 'price_min' => 100.00, 'price_max' => 120.00, 'aliases' => []],
            ['name' => 'Ear Cleaning',          'category' => 'grooming_extra', 'price_min' => 100.00, 'price_max' => 120.00, 'aliases' => []],
            ['name' => 'Face Trim',             'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Poodle Feet',           'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Anal Sac',              'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Paw Shave',             'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => 250.00, 'aliases' => []],
            ['name' => 'Sanitary Shave',        'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => 250.00, 'aliases' => []],
            ['name' => 'Round Face',            'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => 250.00, 'aliases' => []],
            ['name' => 'Dematting - S',         'category' => 'grooming_extra', 'price_min' => 200.00, 'price_max' => null,   'aliases' => ['Dematting']],
            ['name' => 'Dematting - M',         'category' => 'grooming_extra', 'price_min' => 300.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Dematting - L',         'category' => 'grooming_extra', 'price_min' => 400.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Dematting - XL',        'category' => 'grooming_extra', 'price_min' => 500.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Medicated Bath - S',    'category' => 'grooming_extra', 'price_min' => 150.00, 'price_max' => null,   'aliases' => ['Medicated Bath']],
            ['name' => 'Medicated Bath - M',    'category' => 'grooming_extra', 'price_min' => 250.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Medicated Bath - L',    'category' => 'grooming_extra', 'price_min' => 350.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Organic Bath - S',      'category' => 'grooming_extra', 'price_min' => 250.00, 'price_max' => null,   'aliases' => ['Organic Bath']],
            ['name' => 'Organic Bath - M',      'category' => 'grooming_extra', 'price_min' => 350.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Whitening - S',         'category' => 'grooming_extra', 'price_min' => 250.00, 'price_max' => null,   'aliases' => ['Whitening', 'Whitening Bath']],
            ['name' => 'Whitening - M',         'category' => 'grooming_extra', 'price_min' => 350.00, 'price_max' => null,   'aliases' => []],
            ['name' => 'Mind of Play Package',  'category' => 'daycare_upgrade','price_min' => 150.00, 'price_max' => null],
        ];

        $activeGroomingExtras = [];

        foreach ($rows as $row) {
            $aliases = $row['aliases'] ?? [];
            unset($row['aliases']);

            if ($row['category'] === 'grooming_extra') {
                $activeGroomingExtras[] = $row['name'];
            }

            $addon = ServiceAddon::whereIn('name', array_merge([$row['name']], $aliases))->first();

            if (! $addon) {
                $addon = new ServiceAddon();
            }

            $addon->fill([
                'name'             => $row['name'],
                'category'         => $row['category'],
                'price_min'        => $row['price_min'],
                'price_max'        => $row['price_max'],
                'has_size_pricing' => (bool) preg_match('/\s-\s(?:S|M|L|XL|XXL)$/i', $row['name']),
                'applies_to_grooming' => $row['category'] === 'grooming_extra',
                'applies_to_daycare' => $row['category'] === 'daycare_upgrade',
                'applies_to_hotel' => false,
                'is_active'        => true,
                'deactivation_reason' => null,
            ])->save();
        }

        $staleGroomingAddons = ServiceAddon::whereIn('category', ['grooming_extra', 'grooming_addon', 'hotel_grooming'])
            ->whereNotIn('name', $activeGroomingExtras);

        (clone $staleGroomingAddons)
            ->doesntHave('appointmentAddons')
            ->delete();

        $staleGroomingAddons
            ->has('appointmentAddons')
            ->whereNotIn('name', $activeGroomingExtras)
            ->update([
                'is_active' => false,
                'deactivation_reason' => 'Replaced by Pawsome extras.',
            ]);

        $hotelAddons = ServiceAddon::whereIn('category', ['treatment', 'hotel_grooming']);

        (clone $hotelAddons)
            ->doesntHave('appointmentAddons')
            ->delete();

        $hotelAddons
            ->has('appointmentAddons')
            ->update([
                'is_active' => false,
                'deactivation_reason' => 'Hotel has no add-ons.',
            ]);
    }
}
