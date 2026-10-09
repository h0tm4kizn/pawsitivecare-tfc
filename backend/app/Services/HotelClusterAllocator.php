<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\ShopHoursSetting;
use App\Models\HotelSuite;
use Carbon\Carbon;

class HotelClusterAllocator
{
    private const DEFAULT_CLUSTER_CAPACITY = [
        'A' => 6,
        'B' => 6,
        'C' => 3,
        'D' => 3,
    ];

    private const CLUSTER_SUITE_NAMES = [
        'A' => ['The Cozy Paw Suite', 'The Cozy Whiskers'],
        'B' => ['The Happy Paws Suite', 'The Grand Purr Suite'],
        'C' => ['The Grand Paw Suite', 'The VIPaws Suite'],
        'D' => ['The VIPurr Villa'],
    ];

    private const ACTIVE_OCCUPANCY_STATUSES = ['approved', 'in_progress', 'checkin', 'checked_in'];

    private const NIGHTLY_RATES = [
        'The Cozy Paw Suite' => 650.00,
        'The Cozy Whiskers' => 550.00,
        'The Happy Paws Suite' => 750.00,
        'The Grand Purr Suite' => 650.00,
        'The Grand Paw Suite' => 950.00,
        'The VIPaws Suite' => 1050.00,
        'The VIPurr Villa' => 750.00,
    ];

    public function normalizeSpecies(?string $species): ?string
    {
        if (!$species) {
            return null;
        }

        $normalized = strtolower(trim($species));

        if (in_array($normalized, ['dog', 'dogs', 'canine'], true)) {
            return 'dog';
        }

        if (in_array($normalized, ['cat', 'cats', 'feline'], true)) {
            return 'cat';
        }

        if ($normalized === 'd') {
            return 'dog';
        }

        if ($normalized === 'c') {
            return 'cat';
        }

        return null;
    }

    public function normalizeDogSize(?string $size): ?string
    {
        if (!$size) {
            return null;
        }

        $value = strtolower(trim($size));

        if (str_contains($value, 'extra large') || str_contains($value, 'xlarge') || str_contains($value, 'x-large') || str_contains($value, 'xl')) {
            return 'extra_large';
        }

        if (str_contains($value, 'large')) {
            return 'large';
        }

        if (str_contains($value, 'medium')) {
            return 'medium';
        }

        if (str_contains($value, 'small') || str_contains($value, 'xs') || str_contains($value, 'xsmall') || str_contains($value, 'x-small')) {
            return 'small';
        }

        return null;
    }

    public function normalizeConfirmedPetSize(?string $size, ?string $species): ?string
    {
        $value = trim((string) $size);
        if (!$value) {
            return null;
        }

        if ($species === 'dog') {
            return match ($this->normalizeDogSize($value)) {
                'small' => 'Small',
                'medium' => 'Medium',
                'large' => 'Large',
                'extra_large' => 'XLarge',
                default => null,
            };
        }

        if ($species === 'cat') {
            return match (strtoupper($value)) {
                'CAT' => 'CAT',
                'KITTEN' => 'KITTEN',
                default => null,
            };
        }

        return null;
    }

    public function inferDogSizeFromSuiteName(?string $suiteName): ?string
    {
        if (!$suiteName) {
            return null;
        }

        return match ($suiteName) {
            'The Cozy Paw Suite' => 'small',
            'The Happy Paws Suite' => 'medium',
            'The Grand Paw Suite' => 'large',
            'The VIPaws Suite' => 'extra_large',
            default => null,
        };
    }

    public function clusterFromSuiteName(?string $suiteName): ?string
    {
        if (!$suiteName) {
            return null;
        }

        foreach (self::CLUSTER_SUITE_NAMES as $cluster => $suiteNames) {
            if (in_array($suiteName, $suiteNames, true)) {
                return $cluster;
            }
        }

        return null;
    }

    /**
     * Return the authoritative physical hotel occupancy snapshot.
     * Reservations do not consume current occupancy until actual check-in.
     */
    public function currentOccupancySnapshot(?Carbon $asOf = null): array
    {
        $asOf = ($asOf ?? now('Asia/Manila'))->copy()->timezone('Asia/Manila');
        $occupantsByCluster = [];
        $speciesCounts = ['dog' => 0, 'cat' => 0, 'unknown' => 0];

        $appointments = Appointment::query()
            ->with([
                'pet:id,name,pet_id,species_id',
                'pet.speciesType:id,name,code',
                'hotelSuite:id,name',
                'service:id,category',
            ])
            ->whereHas('service', fn($q) => $q->where('category', 'hotel'))
            ->whereNotIn('status', ['cancelled', 'completed', 'no_show', 'rejected'])
            ->whereNotNull('actual_check_in_at')
            ->whereNull('actual_check_out_at')
            ->where('actual_check_in_at', '<=', $asOf)
            ->get();

        foreach ($appointments as $appointment) {
            $cluster = $this->clusterFromSuiteName($appointment->hotelSuite?->name);
            if (!$cluster) {
                continue;
            }

            $species = $this->normalizeSpecies(
                $appointment->pet?->speciesType?->name ?? $appointment->pet?->speciesType?->code
            ) ?? 'unknown';
            $speciesCounts[$species] += 1;
            $checkedInAt = $appointment->actual_check_in_at?->copy()->timezone('Asia/Manila');
            $expectedOutAt = $appointment->scheduled_check_out_at?->copy()->timezone('Asia/Manila');

            $occupantsByCluster[$cluster][] = [
                'appointment_id' => $appointment->id,
                'pet_name' => $appointment->pet?->name ?? 'Unknown pet',
                'pet_id' => $appointment->pet?->pet_id,
                'species' => $species,
                'suite_name' => $appointment->hotelSuite?->name,
                'checked_in_at' => $checkedInAt?->toIso8601String(),
                'expected_out_at' => $expectedOutAt?->toIso8601String(),
                'overdue' => (bool) ($expectedOutAt && $expectedOutAt->lt($asOf)),
                'status' => $appointment->status,
                '_occupancy_unit' => $cluster === 'D' && $appointment->booked_by_owner_id
                    ? 'owner:' . $appointment->booked_by_owner_id
                    : 'appointment:' . $appointment->id,
            ];
        }

        $occupied = 0;
        $clusters = [];
        $capacityMap = $this->capacityMap();
        foreach (['A', 'B', 'C', 'D'] as $cluster) {
            $occupants = $occupantsByCluster[$cluster] ?? [];
            $units = collect($occupants)->pluck('_occupancy_unit')->unique()->count();
            $occupied += $units;
            $clusters[] = [
                'cluster' => $cluster,
                'capacity' => $capacityMap[$cluster] ?? 0,
                'occupied' => $units,
                'available' => max(0, ($capacityMap[$cluster] ?? 0) - $units),
                'is_available' => $units < ($capacityMap[$cluster] ?? 0),
                'species_counts' => collect($occupants)->countBy('species')->union(['dog' => 0, 'cat' => 0, 'unknown' => 0])->only(['dog', 'cat', 'unknown'])->all(),
                'occupants' => array_map(function (array $occupant): array {
                    unset($occupant['_occupancy_unit']);
                    return $occupant;
                }, $occupants),
            ];
        }

        return [
            'clusters' => $clusters,
            'occupied' => $occupied,
            'species_counts' => $speciesCounts,
        ];
    }

    public function resolveEligibleOptions(string $species, ?string $dogSize): array
    {
        if ($species === 'cat') {
            return [
                $this->buildOption('A', 'The Cozy Whiskers', 550.00),
                $this->buildOption('B', 'The Grand Purr Suite', 650.00),
                $this->buildOption('D', 'The VIPurr Villa', 750.00),
            ];
        }

        if ($species !== 'dog') {
            return [];
        }

        return match ($dogSize) {
            'small' => [
                $this->buildOption('A', 'The Cozy Paw Suite', 650.00),
                $this->buildOption('B', 'The Happy Paws Suite', 750.00),
                $this->buildOption('C', 'The Grand Paw Suite', 950.00),
            ],
            'medium' => [
                $this->buildOption('B', 'The Happy Paws Suite', 750.00),
                $this->buildOption('C', 'The Grand Paw Suite', 950.00),
            ],
            'large' => [
                $this->buildOption('C', 'The Grand Paw Suite', 950.00),
            ],
            'extra_large' => [
                $this->buildOption('C', 'The VIPaws Suite', 1050.00, 'vipaws_upcharge'),
            ],
            default => [
                $this->buildOption('A', 'The Cozy Paw Suite', 650.00),
                $this->buildOption('B', 'The Happy Paws Suite', 750.00),
                $this->buildOption('C', 'The Grand Paw Suite', 950.00),
            ],
        };
    }

    public function validateSuiteSelection(string $species, ?string $dogSize, string $suiteName): ?array
    {
        $allowed = $this->resolveEligibleOptions($species, $dogSize);

        foreach ($allowed as $option) {
            if ($option['suite_name'] === $suiteName) {
                return $option;
            }
        }

        return null;
    }

    public function getNightlyRateForSuite(string $suiteName): float
    {
        return self::NIGHTLY_RATES[$suiteName] ?? 0.0;
    }

    public function clusterInventory(string $cluster, string $checkIn, int $nights, ?string $ownerId = null, ?string $excludeAppointmentId = null): array
    {
        $nights = max(1, $nights);
        $dates = [];
        $start = Carbon::parse($checkIn, 'Asia/Manila')->startOfDay();
        for ($offset = 0; $offset < $nights; $offset++) {
            $dates[] = $start->copy()->addDays($offset)->toDateString();
        }

        $daily = $this->clusterInventoryByDate($cluster, $dates, $ownerId, $excludeAppointmentId);
        $limitingDay = collect($daily)->sortBy('available')->first();
        $capacity = $this->clusterCapacity($cluster);
        $occupied = $limitingDay['occupied'] ?? 0;

        return [
            'cluster' => $cluster,
            'capacity' => $capacity,
            'occupied' => $occupied,
            'available' => max(0, $capacity - $occupied),
            'is_available' => $occupied < $capacity,
            'daily' => $daily,
        ];
    }

    /**
     * Return remaining shared cluster inventory for each requested night.
     * An unchecked-out pet that has actually checked in occupies a unit until checkout,
     * even when its scheduled stay has ended.
     */
    public function clusterInventoryByDate(
        string $cluster,
        array $dates,
        ?string $ownerId = null,
        ?string $excludeAppointmentId = null
    ): array {
        $dates = array_values(array_unique(array_map(
            fn ($date) => Carbon::parse($date, 'Asia/Manila')->toDateString(),
            $dates
        )));
        if (!$dates) {
            return [];
        }

        sort($dates);
        $rangeStart = $dates[0];
        $rangeEnd = Carbon::parse(end($dates), 'Asia/Manila')->addDay()->toDateString();
        $now = now('Asia/Manila');
        $query = Appointment::query()
            ->whereHas('service', fn($q) => $q->where('category', 'hotel'))
            ->where(function ($statusQuery) {
                $statusQuery->whereIn('status', self::ACTIVE_OCCUPANCY_STATUSES)
                    ->orWhere(function ($pendingQuery) {
                        $pendingQuery->where('status', 'pending')
                            ->where('capacity_hold_expires_at', '>', now('Asia/Manila'));
                    });
            })
            ->when($excludeAppointmentId, fn($q) => $q->whereKeyNot($excludeAppointmentId))
            ->where(function ($overlapQuery) use ($rangeStart, $rangeEnd, $now) {
                $overlapQuery
                    ->where(function ($scheduledQuery) use ($rangeStart, $rangeEnd) {
                        $scheduledQuery->where('appointment_date', '<', $rangeEnd);
                        $this->whereStayEndsAfter($scheduledQuery, $rangeStart);
                    })
                    ->orWhere(function ($checkedInQuery) use ($now) {
                        $checkedInQuery
                            ->whereNotNull('actual_check_in_at')
                            ->whereNull('actual_check_out_at')
                            ->where('actual_check_in_at', '<=', $now);
                    });
            });
        $query
            ->whereHas('hotelSuite', fn($q) => $q->whereIn('name', self::CLUSTER_SUITE_NAMES[$cluster] ?? []));

        $capacity = $this->clusterCapacity($cluster);
        $appointments = $query
            ->with('hotelSuite:id,name')
            ->get([
                'id',
                'hotel_suite_id',
                'appointment_date',
                'hotel_nights',
                'booked_by_owner_id',
                'actual_check_in_at',
                'actual_check_out_at',
            ]);

        $daily = [];
        foreach ($dates as $date) {
            $occupiedAppointments = $appointments->filter(function (Appointment $appointment) use ($date, $now) {
                if ($appointment->actual_check_in_at && !$appointment->actual_check_out_at
                    && $appointment->actual_check_in_at->lte($now)
                    && $date >= $appointment->actual_check_in_at->timezone('Asia/Manila')->toDateString()) {
                    return true;
                }

                if ($appointment->actual_check_out_at
                    && $appointment->actual_check_out_at->timezone('Asia/Manila')->toDateString() <= $date) {
                    return false;
                }

                $checkIn = Carbon::parse($appointment->appointment_date, 'Asia/Manila')->toDateString();
                $checkOut = Carbon::parse($checkIn, 'Asia/Manila')
                    ->addDays(max(1, (int) ($appointment->hotel_nights ?? 1)))
                    ->toDateString();

                return $date >= $checkIn && $date < $checkOut;
            });

            if ($cluster === 'D') {
                $ownerUnits = $occupiedAppointments->whereNotNull('booked_by_owner_id')
                    ->pluck('booked_by_owner_id')
                    ->unique()
                    ->count();
                $unownedUnits = $occupiedAppointments->whereNull('booked_by_owner_id')->count();
                $occupied = $ownerUnits + $unownedUnits;
                if ($ownerId && $occupiedAppointments->contains(
                    fn (Appointment $appointment) => (string) $appointment->booked_by_owner_id === (string) $ownerId
                )) {
                    $occupied = max(0, $occupied - 1);
                }
            } else {
                $occupied = $occupiedAppointments->count();
            }

            $daily[$date] = [
                'cluster' => $cluster,
                'capacity' => $capacity,
                'occupied' => $occupied,
                'available' => max(0, $capacity - $occupied),
                'is_available' => $occupied < $capacity,
            ];
        }

        return $daily;
    }

    public function capacityMap(): array
    {
        $saved = ShopHoursSetting::get('cages', []);
        if (!is_array($saved)) {
            $saved = [];
        }

        return [
            'A' => max(0, (int)($saved['A'] ?? self::DEFAULT_CLUSTER_CAPACITY['A'])),
            'B' => max(0, (int)($saved['B'] ?? self::DEFAULT_CLUSTER_CAPACITY['B'])),
            'C' => max(0, (int)($saved['C'] ?? self::DEFAULT_CLUSTER_CAPACITY['C'])),
            'D' => max(0, (int)($saved['D'] ?? self::DEFAULT_CLUSTER_CAPACITY['D'])),
        ];
    }

    public function lockCapacityForUpdate(): void
    {
        $connection = \Illuminate\Support\Facades\DB::connection();
        if ($connection->getDriverName() === 'pgsql') {
            $connection->select('SELECT pg_advisory_xact_lock(2026100801)');
            return;
        }

        ShopHoursSetting::query()->whereKey('cages')->lockForUpdate()->first();
    }

    public function optionsWithInventory(
        string $species,
        ?string $dogSize,
        string $checkIn,
        int $nights,
        ?string $ownerId = null
    ): array {
        $options = $this->resolveEligibleOptions($species, $dogSize);

        return array_map(function (array $option) use ($checkIn, $nights, $ownerId) {
            $inventory = $this->clusterInventory($option['cluster'], $checkIn, $nights, $ownerId);
            $suite = HotelSuite::query()->where('name', $option['suite_name'])->whereRaw('"is_available" = true')->first();

            $option['suite_id'] = $suite?->id;
            $option['capacity'] = $inventory['capacity'];
            $option['occupied'] = $inventory['occupied'];
            $option['available'] = $inventory['available'];
            $option['is_available'] = $inventory['is_available'];

            return $option;
        }, $options);
    }

    /**
     * Count pets (appointments) that an owner already has in Cluster D for overlapping dates.
     * Used to enforce the max-5-cats-per-unit household limit.
     */
    public function householdPetCount(
        string $ownerId,
        string $checkIn,
        int $nights,
        ?string $excludeAppointmentId = null
    ): int
    {
        $nights  = max(1, $nights);
        $checkOut = date('Y-m-d', strtotime($checkIn . " +{$nights} days"));

        $query = Appointment::query()
            ->where('booked_by_owner_id', $ownerId)
            ->when($excludeAppointmentId, fn ($q) => $q->whereKeyNot($excludeAppointmentId))
            ->where(function ($statusQuery) {
                $statusQuery->whereIn('status', self::ACTIVE_OCCUPANCY_STATUSES)
                    ->orWhere(function ($pendingQuery) {
                        $pendingQuery->where('status', 'pending')
                            ->where('capacity_hold_expires_at', '>', now('Asia/Manila'));
                    });
            })
            ->whereHas('service', fn($q) => $q->where('category', 'hotel'))
            ->whereHas('hotelSuite', fn($q) => $q->whereIn('name', self::CLUSTER_SUITE_NAMES['D']))
            ->where(function ($overlapQuery) use ($checkIn, $checkOut) {
                $overlapQuery
                    ->where(function ($scheduledQuery) use ($checkIn, $checkOut) {
                        $scheduledQuery->where('appointment_date', '<', $checkOut);
                        $this->whereStayEndsAfter($scheduledQuery, $checkIn);
                    })
                    ->orWhere(function ($checkedInQuery) {
                        $checkedInQuery
                            ->whereNotNull('actual_check_in_at')
                            ->whereNull('actual_check_out_at')
                            ->where('actual_check_in_at', '<=', now('Asia/Manila'));
                    });
            });

        return $query
            ->count();
    }

    private function buildOption(string $cluster, string $suiteName, float $nightlyRate, string $pricingState = 'standard'): array
    {
        return [
            'cluster' => $cluster,
            'suite_name' => $suiteName,
            'nightly_rate' => $nightlyRate,
            'pricing_state' => $pricingState,
        ];
    }

    private function clusterCapacity(string $cluster): int
    {
        $map = $this->capacityMap();
        return $map[$cluster] ?? 0;
    }

    private function whereStayEndsAfter($query, string $date): void
    {
        if ($query->getConnection()->getDriverName() === 'sqlite') {
            $query->whereRaw("date(appointment_date, '+' || MAX(COALESCE(hotel_nights, 1), 1) || ' days') > ?", [$date]);
            return;
        }
        $query->whereRaw("appointment_date + (GREATEST(COALESCE(hotel_nights,1),1) * INTERVAL '1 day') > ?", [$date]);
    }
}
