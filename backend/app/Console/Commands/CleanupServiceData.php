<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupServiceData extends Command
{
    protected $signature = 'cleanup:service-data';
    protected $description = 'Clean up service data - fix categorization and remove duplicates';

    public function handle()
    {
        $this->info('Starting service data cleanup...');
        $this->newLine();

        // 1. Fix miscategorized services
        $this->info('Step 1: Fixing miscategorized services...');
        
        // Hotel Boarding should be in hotel category
        $hotelBoardingFixed = DB::table('services')
            ->where('name', 'Hotel Boarding')
            ->where('category', '!=', 'hotel')
            ->update(['category' => 'hotel']);
        
        if ($hotelBoardingFixed) {
            $this->line("  ✓ Fixed 'Hotel Boarding' category");
        }

        // Daycare Hourly should be in daycare category
        $daycareHourlyFixed = DB::table('services')
            ->where('name', 'Daycare Hourly')
            ->where('category', '!=', 'daycare')
            ->update(['category' => 'daycare']);
        
        if ($daycareHourlyFixed) {
            $this->line("  ✓ Fixed 'Daycare Hourly' category");
        }

        $this->newLine();

        // 2. Find and report duplicate services
        $this->info('Step 2: Checking for duplicate services...');
        
        $duplicates = DB::table('services')
            ->select('name', 'category', DB::raw('COUNT(*) as cnt'))
            ->groupBy('name', 'category')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isEmpty()) {
            $this->line("  ✓ No duplicates found");
        } else {
            $this->warn("  ⚠ Found duplicates:");
            foreach ($duplicates as $dup) {
                $this->line("    - {$dup->name} ({$dup->category}): {$dup->cnt} entries");
            }
            $this->newLine();
            $this->warn("  Please manually review and remove duplicates in the admin panel.");
        }

        $this->newLine();

        // 3. Verify all services have tiers
        $this->info('Step 3: Verifying all services have tiers...');
        
        $servicesWithoutTiers = DB::table('services')
            ->leftJoin('service_tiers', 'services.id', '=', 'service_tiers.service_id')
            ->whereNull('service_tiers.id')
            ->where('services.is_active', true)
            ->select('services.id', 'services.name', 'services.category')
            ->get();

        if ($servicesWithoutTiers->isEmpty()) {
            $this->line("  ✓ All active services have tiers");
        } else {
            $this->warn("  ⚠ Services without tiers:");
            foreach ($servicesWithoutTiers as $service) {
                $this->line("    - {$service->name} ({$service->category})");
            }
        }

        $this->newLine();

        // 4. Clean up addon service_id references (should be null for category-based)
        $this->info('Step 4: Cleaning up addon references...');
        
        $addonsWithServiceId = DB::table('service_addons')
            ->whereNotNull('service_id')
            ->count();

        if ($addonsWithServiceId > 0) {
            $this->warn("  ⚠ Found {$addonsWithServiceId} addons with service_id (old structure)");
            $this->line("    These should be category-based. Keeping for backward compatibility.");
        } else {
            $this->line("  ✓ All addons are category-based");
        }

        $this->newLine();

        // 5. Verify addon categorization
        $this->info('Step 5: Verifying addon categorization...');
        
        $groomingAddons = DB::table('service_addons')
            ->where('category', 'grooming_extra')
            ->where('is_active', true)
            ->count();
        
        $daycareAddons = DB::table('service_addons')
            ->where('category', 'daycare_upgrade')
            ->where('is_active', true)
            ->count();
        
        $hotelAddons = DB::table('service_addons')
            ->where('category', 'treatment')
            ->where('is_active', true)
            ->count();

        $this->line("  ✓ Grooming addons: {$groomingAddons}");
        $this->line("  ✓ Daycare upgrades: {$daycareAddons}");
        $this->line("  ✓ Hotel addons: {$hotelAddons}");

        $this->newLine();

        // 6. Verify hotel suites
        $this->info('Step 6: Verifying hotel suites...');
        
        $dogSuites = DB::table('hotel_suites')
            ->where('species_type', 'dog')
            ->where('is_available', true)
            ->count();
        
        $catSuites = DB::table('hotel_suites')
            ->where('species_type', 'cat')
            ->where('is_available', true)
            ->count();

        $this->line("  ✓ Dog suites available: {$dogSuites}");
        $this->line("  ✓ Cat suites available: {$catSuites}");

        $this->newLine();
        $this->info('✅ Cleanup complete!');
        
        return 0;
    }
}
