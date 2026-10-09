<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class NormalizePetIds extends Command
{
    protected $signature = 'pets:normalize-ids {--dry-run : Preview changes without saving}';
    protected $description = 'Normalize pet_id values to DOG/CAT + YY + 4-digit sequence, grouped by species and year.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $this->info($dryRun ? 'Running in DRY-RUN mode (no DB writes).' : 'Running pet_id normalization.');

        $pets = DB::table('pets as p')
            ->join('species_types as st', 'st.id', '=', 'p.species_id')
            ->select('p.id', 'p.pet_id', 'p.name', 'p.created_at', DB::raw('lower(st.name) as species_name'))
            ->whereIn(DB::raw('lower(st.name)'), ['dog', 'cat'])
            ->orderBy('p.created_at')
            ->orderBy('p.id')
            ->get();

        if ($pets->isEmpty()) {
            $this->line('No dog/cat pets found.');
            return Command::SUCCESS;
        }

        $seqByBucket = [];
        $changes = [];

        foreach ($pets as $pet) {
            $prefix = $pet->species_name === 'dog' ? 'DOG' : 'CAT';
            $yy = date('y', strtotime((string) $pet->created_at));
            $bucket = $prefix . $yy;
            $seqByBucket[$bucket] = ($seqByBucket[$bucket] ?? 0) + 1;
            $target = $bucket . str_pad((string) $seqByBucket[$bucket], 4, '0', STR_PAD_LEFT);

            if ((string) $pet->pet_id !== $target) {
                $changes[] = [
                    'id' => $pet->id,
                    'name' => $pet->name,
                    'from' => (string) $pet->pet_id,
                    'to' => $target,
                ];
            }
        }

        if (empty($changes)) {
            $this->info('All pet IDs are already normalized.');
            return Command::SUCCESS;
        }

        $this->info('Planned changes: ' . count($changes));
        foreach (array_slice($changes, 0, 20) as $row) {
            $this->line(" - {$row['name']} ({$row['id']}): {$row['from']} -> {$row['to']}");
        }
        if (count($changes) > 20) {
            $this->line(' ...and ' . (count($changes) - 20) . ' more');
        }

        if ($dryRun) {
            $this->comment('Dry run complete. Re-run without --dry-run to apply changes.');
            return Command::SUCCESS;
        }

        DB::transaction(function () use ($changes) {
            // Phase 1: assign temporary, format-valid IDs to avoid unique collisions
            // while still satisfying the pets pet_id format check constraint.
            $tmpSeqByPrefixYear = [];
            foreach ($changes as $row) {
                $target = (string) $row['to'];
                $prefixYear = substr($target, 0, 5); // e.g. DOG26, CAT26
                $tmpSeqByPrefixYear[$prefixYear] = ($tmpSeqByPrefixYear[$prefixYear] ?? 8999) + 1;
                $tmp = $prefixYear . str_pad((string) $tmpSeqByPrefixYear[$prefixYear], 4, '0', STR_PAD_LEFT);

                DB::table('pets')
                    ->where('id', $row['id'])
                    ->update(['pet_id' => $tmp]);
            }

            // Phase 2: assign final normalized IDs.
            foreach ($changes as $row) {
                DB::table('pets')
                    ->where('id', $row['id'])
                    ->update(['pet_id' => $row['to']]);
            }
        });

        $this->info('Pet ID normalization complete.');
        return Command::SUCCESS;
    }
}
