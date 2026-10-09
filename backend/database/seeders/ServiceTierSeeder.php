<?php

namespace Database\Seeders;

use App\Models\Service;
use App\Models\ServiceTier;
use Illuminate\Database\Seeder;

class ServiceTierSeeder extends Seeder
{
    private function weightRangeForLabel(string $label): array
    {
        $normalized = strtoupper(trim($label));
        if (str_contains($normalized, ' - ')) {
            $parts = explode(' - ', $normalized);
            $normalized = trim((string) end($parts));
        }

        return match ($normalized) {
            'S', 'SMALL' => [0.00, 5.00],
            'SMALL TO MEDIUM' => [0.00, 10.00],
            'M', 'MEDIUM' => [6.00, 10.00],
            'L', 'LARGE' => [11.00, 15.00],
            'XL', 'XLARGE', 'X-LARGE' => [15.00, 20.00],
            'XXL', 'XXLARGE', 'XX-LARGE', 'GIANT' => [20.00, null],
            default => [null, null],
        };
    }

    public function run(): void
    {
        // price     = minimum (or fixed) price
        // price_max = maximum price for range-based services (null = fixed price)

        $tiersByService = [

            // ---------------------------------------------------------------
            // GROOMING SERVICES
            // ---------------------------------------------------------------

            'Fresh me up' => [
                ['size_label' => 'S',     'price' => 450.00,  'price_max' => null,    'duration_hours' => 1.0],
                ['size_label' => 'M',     'price' => 550.00,  'price_max' => null,    'duration_hours' => 1.5],
                ['size_label' => 'L',     'price' => 750.00,  'price_max' => null,    'duration_hours' => 2.0],
                ['size_label' => 'XL',    'price' => 850.00,  'price_max' => null,    'duration_hours' => 2.5],
                ['size_label' => 'XXL',   'price' => 1050.00, 'price_max' => null,    'duration_hours' => 3.0],
                ['size_label' => 'GIANT', 'price' => 1250.00, 'price_max' => null,    'duration_hours' => 3.5],
                ['size_label' => 'CAT',   'price' => 550.00,  'price_max' => null,    'duration_hours' => 1.5],
            ],

            'Tidy up' => [
                ['size_label' => 'S',      'price' => 350.00,  'price_max' => null,    'duration_hours' => 1.0],
                ['size_label' => 'M',      'price' => 450.00,  'price_max' => null,    'duration_hours' => 1.5],
                ['size_label' => 'L',      'price' => 650.00,  'price_max' => null,    'duration_hours' => 2.0],
                ['size_label' => 'XL',     'price' => 750.00,  'price_max' => null,    'duration_hours' => 2.5],
                ['size_label' => 'XXL',    'price' => 950.00,  'price_max' => null,    'duration_hours' => 3.0],
                ['size_label' => 'GIANT',  'price' => 1150.00, 'price_max' => null,    'duration_hours' => 3.5],
                ['size_label' => 'KITTEN', 'price' => 650.00,  'price_max' => null,    'duration_hours' => 1.0],
                ['size_label' => 'CAT',    'price' => 750.00,  'price_max' => 1050.00, 'duration_hours' => 1.5],
            ],

            'Glow up' => [
                ['size_label' => 'S',      'price' => 450.00,  'price_max' => null,    'duration_hours' => 1.5],
                ['size_label' => 'M',      'price' => 550.00,  'price_max' => null,    'duration_hours' => 2.0],
                ['size_label' => 'L',      'price' => 750.00,  'price_max' => null,    'duration_hours' => 2.5],
                ['size_label' => 'XL',     'price' => 850.00,  'price_max' => null,    'duration_hours' => 3.0],
                ['size_label' => 'XXL',    'price' => 1050.00, 'price_max' => null,    'duration_hours' => 3.5],
                ['size_label' => 'GIANT',  'price' => 1250.00, 'price_max' => null,    'duration_hours' => 4.0],
                ['size_label' => 'KITTEN', 'price' => 650.00,  'price_max' => null,    'duration_hours' => 1.0],
                ['size_label' => 'CAT',    'price' => 750.00,  'price_max' => 1050.00, 'duration_hours' => 1.5],
            ],

            'Glam up' => [
                ['size_label' => 'S',      'price' => 550.00,  'price_max' => null,    'duration_hours' => 2.0],
                ['size_label' => 'M',      'price' => 650.00,  'price_max' => null,    'duration_hours' => 2.5],
                ['size_label' => 'L',      'price' => 850.00,  'price_max' => null,    'duration_hours' => 3.0],
                ['size_label' => 'XL',     'price' => 1050.00, 'price_max' => null,    'duration_hours' => 3.5],
                ['size_label' => 'XXL',    'price' => 1250.00, 'price_max' => null,    'duration_hours' => 4.0],
                ['size_label' => 'GIANT',  'price' => 1450.00, 'price_max' => null,    'duration_hours' => 4.5],
                ['size_label' => 'KITTEN', 'price' => 650.00,  'price_max' => null,    'duration_hours' => 1.0],
                ['size_label' => 'CAT',    'price' => 750.00,  'price_max' => 1050.00, 'duration_hours' => 1.5],
            ],

            'Pawsome Extras' => [
                ['size_label' => 'Standard', 'price' => 0.00, 'price_max' => null, 'duration_hours' => 1.0],
            ],

            // ---------------------------------------------------------------
            // DAYCARE
            // Composite size_label = duration_type + pet_size
            // AppointmentController looks up price by size_label directly.
            // ---------------------------------------------------------------

            'Daycare' => [
                ['size_label' => 'Hourly - Small',   'price' => 80.00,  'price_max' => null, 'duration_hours' => 1.0],
                ['size_label' => 'Hourly - Medium',  'price' => 80.00,  'price_max' => null, 'duration_hours' => 1.0],
                ['size_label' => 'Hourly - Large',   'price' => 100.00, 'price_max' => null, 'duration_hours' => 1.0],
                ['size_label' => 'Hourly - XLarge',  'price' => 110.00, 'price_max' => null, 'duration_hours' => 1.0],
                ['size_label' => 'Half Day - Small',  'price' => 250.00, 'price_max' => null, 'duration_hours' => 4.0],
                ['size_label' => 'Half Day - Medium', 'price' => 300.00, 'price_max' => null, 'duration_hours' => 4.0],
                ['size_label' => 'Half Day - Large',  'price' => 350.00, 'price_max' => null, 'duration_hours' => 4.0],
                ['size_label' => 'Half Day - XLarge', 'price' => 400.00, 'price_max' => null, 'duration_hours' => 4.0],
                ['size_label' => 'Full Day - Small',  'price' => 500.00, 'price_max' => null, 'duration_hours' => 8.0],
                ['size_label' => 'Full Day - Medium', 'price' => 600.00, 'price_max' => null, 'duration_hours' => 8.0],
                ['size_label' => 'Full Day - Large',  'price' => 700.00, 'price_max' => null, 'duration_hours' => 8.0],
                ['size_label' => 'Full Day - XLarge', 'price' => 800.00, 'price_max' => null, 'duration_hours' => 8.0],
            ],

            // ---------------------------------------------------------------
            // HOTEL
            // Price = 0 — actual nightly cost comes from hotel_suites.price_per_night
            // ---------------------------------------------------------------

            'Pet Hotel Boarding' => [
                ['size_label' => 'The Cozy Paw Suite',  'price' => 650.00,  'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The Happy Paws Suite', 'price' => 750.00,  'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The Grand Paw Suite',  'price' => 950.00,  'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The VIPaws Suite',     'price' => 1050.00, 'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The Cozy Whiskers',    'price' => 550.00,  'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The Grand Purr Suite', 'price' => 650.00,  'price_max' => null, 'duration_hours' => null],
                ['size_label' => 'The VIPurr Villa',     'price' => 750.00,  'price_max' => null, 'duration_hours' => null],
            ],
        ];

        foreach ($tiersByService as $serviceName => $tiers) {
            $service = Service::where('name', $serviceName)->first();

            if (!$service) {
                continue;
            }

            $validLabels = array_map(
                fn ($tierRow) => (string) $tierRow['size_label'],
                $tiers
            );

            ServiceTier::where('service_id', $service->id)
                ->whereNotIn('size_label', $validLabels)
                ->delete();

            foreach ($tiers as $tierRow) {
                [$minWeight, $maxWeight] = $this->weightRangeForLabel((string) $tierRow['size_label']);
                $tier = ServiceTier::firstOrCreate(
                    [
                        'service_id' => $service->id,
                        'size_label' => $tierRow['size_label'],
                    ],
                    [
                        'min_weight_kg'  => $minWeight,
                        'max_weight_kg'  => $maxWeight,
                        'price'          => $tierRow['price'],
                        'price_max'      => $tierRow['price_max'],
                        'duration_hours' => $tierRow['duration_hours'],
                    ]
                );

                $tier->fill([
                    'min_weight_kg'  => $minWeight,
                    'max_weight_kg'  => $maxWeight,
                    'price'          => $tierRow['price'],
                    'price_max'      => $tierRow['price_max'],
                    'duration_hours' => $tierRow['duration_hours'],
                ])->save();
            }
        }
    }
}
