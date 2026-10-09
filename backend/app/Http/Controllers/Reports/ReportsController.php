<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\ReportFilterRequest;
use App\Models\Appointment;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\User;
use App\Models\AppointmentAddon;
use App\Models\HotelExtensionCharge;
use App\Services\StaffReportService;
use App\Services\StaffReportPdfWriter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    private const CACHE_TTL = 600; // 10 minutes

    public function __construct(private readonly StaffReportService $staffReports)
    {
    }

    private function periodLabels(array $validated): array
    {
        return $validated['view'] === 'yearly'
            ? ['January','February','March','April','May','June','July','August','September','October','November','December']
            : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    }

    private function periodLabel($date, array $validated): string
    {
        $dt = Carbon::parse($date);
        if ($validated['view'] === 'yearly') {
            return $dt->format('F');
        }
        return 'Week ' . min(4, max(1, (int) ceil($dt->day / 7)));
    }

    private function dateRange(array $validated): array
    {
        if (!empty($validated['from']) || !empty($validated['to'])) {
            $fallbackStart = $validated['view'] === 'monthly' && !empty($validated['month'])
                ? Carbon::create($validated['year'], $validated['month'], 1)->startOfDay()
                : Carbon::create($validated['year'], 1, 1)->startOfDay();
            $fallbackEnd = $validated['view'] === 'monthly' && !empty($validated['month'])
                ? $fallbackStart->copy()->endOfMonth()->endOfDay()
                : Carbon::create($validated['year'], 12, 31)->endOfDay();
            return [
                !empty($validated['from']) ? Carbon::parse($validated['from'])->startOfDay() : $fallbackStart,
                !empty($validated['to']) ? Carbon::parse($validated['to'])->endOfDay() : $fallbackEnd,
            ];
        }
        if ($validated['view'] === 'monthly' && !empty($validated['month'])) {
            $start = Carbon::create($validated['year'], $validated['month'], 1)->startOfDay();
            $end   = $start->copy()->endOfMonth()->endOfDay();
            return [$start, $end];
        }
        $start = Carbon::create($validated['year'], 1, 1)->startOfDay();
        $end   = Carbon::create($validated['year'], 12, 31)->endOfDay();
        return [$start, $end];
    }

    private function cacheKey(string $method, array $validated): string
    {
        return 'report:' . $method . ':' . md5(serialize($validated));
    }

    public function hotelExtensions(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Appointment::class);
        [$start, $end] = $this->dateRange($request->validated());
        $charges = HotelExtensionCharge::query()
            ->whereBetween('recorded_at', [$start, $end])
            ->with(['appointment:id,appointment_code,appointment_date,pet_id,service_id', 'appointment.pet:id,name', 'handledBy:id,name', 'recordedBy:id,name'])
            ->orderBy('recorded_at')
            ->get();
        return $this->success([
            'summary' => [
                'charge_count' => $charges->count(),
                'extension_charges' => round($charges->sum('amount'), 2),
                'extension_payments' => round($charges->where('payment_status', 'paid')->sum('payment_amount'), 2),
            ],
            'records' => $charges->map(fn ($charge) => [
                'appointment_code' => $charge->appointment?->appointment_code,
                'appointment_date' => $charge->appointment?->appointment_date?->toDateString(),
                'pet_name' => $charge->appointment?->pet?->name,
                'pet_species' => $charge->pet_species,
                'pet_size' => $charge->pet_size,
                'daycare_tier_label' => $charge->daycare_tier_label,
                'hourly_rate' => $charge->hourly_rate,
                'scheduled_checkout_at' => $charge->scheduled_checkout_at?->toIso8601String(),
                'actual_checkout_at' => $charge->actual_checkout_at?->toIso8601String(),
                'extra_minutes' => $charge->extra_minutes,
                'billable_hours' => $charge->billable_hours,
                'amount' => $charge->amount,
                'payment_amount' => $charge->payment_amount,
                'payment_method' => $charge->payment_method,
                'payment_status' => $charge->payment_status,
                'payment_reference' => $charge->payment_reference,
                'handled_by' => $charge->handledBy?->name,
                'recorded_by' => $charge->recordedBy?->name,
                'recorded_at' => $charge->recorded_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    public function appointmentSummary(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Appointment::class);
        $validated = $request->validated();

        $data = Cache::remember($this->cacheKey('appt', $validated), self::CACHE_TTL, function () use ($validated) {
            [$start, $end] = $this->dateRange($validated);

            // Single query for all status counts
            $statusCounts = Appointment::query()
                ->whereBetween('appointment_date', [$start, $end])
                ->selectRaw("
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending'    THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved'   THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status IN ('in_progress','checkin','checked_in') THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'completed'  THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'cancelled'  THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN status = 'cancelled' AND cancellation_type = 'staff_rejection' THEN 1 ELSE 0 END) as staff_rejections,
                    SUM(CASE WHEN status = 'cancelled' AND cancellation_type = 'customer_cancellation' THEN 1 ELSE 0 END) as customer_cancellations,
                    SUM(CASE WHEN status = 'no_show'    THEN 1 ELSE 0 END) as no_show
                ")
                ->first();

            // By service (already a single GROUP BY query)
            $byService = Appointment::query()
                ->whereBetween('appointment_date', [$start, $end])
                ->selectRaw('service_id, COUNT(*) as count')
                ->groupBy('service_id')
                ->with('service:id,name,category')
                ->get()
                ->map(fn ($row) => [
                    'service_id'   => $row->service_id,
                    'service_name' => $row->service->name ?? null,
                    'category'     => $row->service->category ?? null,
                    'count'        => $row->count,
                ]);

            // Period breakdown — load once with eager-loaded service
            $periods = collect($this->periodLabels($validated))
                ->mapWithKeys(fn ($p) => [$p => [
                    'period' => $p, 'total' => 0, 'pending' => 0, 'approved' => 0,
                    'in_progress' => 0, 'completed' => 0, 'cancelled' => 0, 'no_show' => 0,
                    'staff_rejections' => 0, 'customer_cancellations' => 0,
                    'grooming' => 0, 'daycare' => 0, 'hotel' => 0,
                ]])->all();

            Appointment::query()
                ->whereBetween('appointment_date', [$start, $end])
                ->select(['appointment_date', 'status', 'service_id', 'cancellation_type'])
                ->with('service:id,category')
                ->get()
                ->each(function ($a) use (&$periods, $validated) {
                    $p = $this->periodLabel($a->appointment_date, $validated);
                    if (!isset($periods[$p])) return;
                    $periods[$p]['total']++;
                    $s = $a->status;
                    if ($s === 'pending')   $periods[$p]['pending']++;
                    if ($s === 'approved')  $periods[$p]['approved']++;
                    if (in_array($s, ['in_progress','checkin','checked_in'], true)) $periods[$p]['in_progress']++;
                    if ($s === 'completed') $periods[$p]['completed']++;
                    if ($s === 'cancelled') $periods[$p]['cancelled']++;
                    if ($s === 'cancelled' && $a->cancellation_type === 'staff_rejection') $periods[$p]['staff_rejections']++;
                    if ($s === 'cancelled' && $a->cancellation_type === 'customer_cancellation') $periods[$p]['customer_cancellations']++;
                    if ($s === 'no_show')   $periods[$p]['no_show']++;
                    $cat = $a->service?->category;
                    if (in_array($cat, ['grooming','daycare','hotel'], true)) $periods[$p][$cat]++;
                });

            return [
                'total'      => (int) $statusCounts->total,
                'pending'    => (int) $statusCounts->pending,
                'approved'   => (int) $statusCounts->approved,
                'in_progress'=> (int) $statusCounts->in_progress,
                'completed'  => (int) $statusCounts->completed,
                'cancelled'  => (int) $statusCounts->cancelled,
                'staff_rejections' => (int) $statusCounts->staff_rejections,
                'customer_cancellations' => (int) $statusCounts->customer_cancellations,
                'no_show'    => (int) $statusCounts->no_show,
                'by_service' => $byService,
                'periods'    => array_values($periods),
            ];
        });

        return $this->success($data);
    }

    public function customerRegistrations(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Owner::class);
        $validated = $request->validated();

        $data = Cache::remember($this->cacheKey('cust', $validated), self::CACHE_TTL, function () use ($validated) {
            [$start, $end] = $this->dateRange($validated);

            $new        = Owner::whereBetween('created_at', [$start, $end])->count();
            $cumulative = Owner::where('created_at', '<=', $end)->count();

            $periods = collect($this->periodLabels($validated))
                ->mapWithKeys(fn ($p) => [$p => ['period' => $p, 'new_customers' => 0]])
                ->all();

            Owner::whereBetween('created_at', [$start, $end])
                ->select('created_at')
                ->get()
                ->each(function ($o) use (&$periods, $validated) {
                    $p = $this->periodLabel($o->created_at, $validated);
                    if (isset($periods[$p])) $periods[$p]['new_customers']++;
                });

            return [
                'new'        => $new,
                'cumulative' => $cumulative,
                'periods'    => array_values($periods),
            ];
        });

        return $this->success($data);
    }

    public function petRegistrations(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Pet::class);
        $validated = $request->validated();

        $data = Cache::remember($this->cacheKey('pets', $validated), self::CACHE_TTL, function () use ($validated) {
            [$start, $end] = $this->dateRange($validated);

            $new = Pet::whereBetween('created_at', [$start, $end])->count();

            $bySpecies = Pet::whereBetween('created_at', [$start, $end])
                ->selectRaw('species_id, COUNT(*) as count')
                ->groupBy('species_id')
                ->with('speciesType:id,name')
                ->get()
                ->map(fn ($row) => [
                    'species_id'   => $row->species_id,
                    'species_name' => $row->speciesType->name ?? null,
                    'count'        => $row->count,
                ]);

            $periods = collect($this->periodLabels($validated))
                ->mapWithKeys(fn ($p) => [$p => [
                    'period' => $p, 'total' => 0, 'dogs' => 0, 'cats' => 0, 'others' => 0,
                ]])->all();

            Pet::whereBetween('created_at', [$start, $end])
                ->select(['created_at', 'species_id'])
                ->with('speciesType:id,name')
                ->get()
                ->each(function ($pet) use (&$periods, $validated) {
                    $p = $this->periodLabel($pet->created_at, $validated);
                    if (!isset($periods[$p])) return;
                    $periods[$p]['total']++;
                    $species = strtolower($pet->speciesType?->name ?? '');
                    if ($species === 'dog')      $periods[$p]['dogs']++;
                    elseif ($species === 'cat')  $periods[$p]['cats']++;
                    else                         $periods[$p]['others']++;
                });

            return [
                'new'        => $new,
                'by_species' => $bySpecies,
                'periods'    => array_values($periods),
            ];
        });

        return $this->success($data);
    }

    public function serviceUsage(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Appointment::class);
        $validated = $request->validated();

        $data = Cache::remember($this->cacheKey('svc-v3', $validated), self::CACHE_TTL, function () use ($validated) {
            [$start, $end] = $this->dateRange($validated);

            // Report the meaningful booking choice for each category: daycare duration,
            // hotel suite/package, and grooming package. Pawsome Extras are reported below
            // as their own individual grooming services.
            $byService = Appointment::whereBetween('appointment_date', [$start, $end])
                ->with(['service:id,name,category', 'hotelSuite:id,name'])
                ->get()
                ->reject(function ($appointment) {
                    return strtolower((string) ($appointment->service?->category ?? '')) === 'grooming'
                        && strtolower((string) ($appointment->service?->name ?? '')) === 'pawsome extras';
                })
                ->groupBy(function ($appointment) {
                    $category = strtolower((string) ($appointment->service?->category ?? ''));

                    if ($category === 'daycare') {
                        return implode('|', ['daycare', 'duration', $appointment->daycare_duration ?: 'Unspecified duration']);
                    }

                    if ($category === 'hotel') {
                        return implode('|', ['hotel', 'package', $appointment->hotelSuite?->name ?? $appointment->service?->name ?? 'Unspecified package']);
                    }

                    return implode('|', [$category ?: 'other', 'package', $appointment->service?->name ?? 'Unknown service']);
                })
                ->map(function ($appointments, $key) {
                    [$category, $breakdownType, $name] = explode('|', $key, 3);
                    $label = $breakdownType === 'duration'
                        ? ucwords(str_replace(['_', '-'], ' ', $name))
                        : $name;

                    return [
                        'service_name'   => $label,
                        'category'       => $category,
                        'breakdown_type' => $breakdownType,
                        'total'          => $appointments->count(),
                        'completed'      => $appointments->where('status', 'completed')->count(),
                        'cancelled'      => $appointments->where('status', 'cancelled')->count(),
                    ];
                })
                ->values();

            $addonCounts = AppointmentAddon::query()
                ->whereHas('appointment', fn ($q) => $q->whereBetween('appointment_date', [$start, $end]))
                ->selectRaw('addon_id, COUNT(*) as count')
                ->groupBy('addon_id')
                ->with('serviceAddon:id,name,category')
                ->orderByDesc('count')
                ->get()
                ->map(fn ($row) => [
                    'addon_id'   => $row->addon_id,
                    'addon_name' => $row->serviceAddon->name ?? null,
                    'category'   => $row->serviceAddon->category ?? null,
                    'count'      => $row->count,
                ]);

            $cancellationReasons = Appointment::whereBetween('appointment_date', [$start, $end])
                ->where('status', 'cancelled')
                ->selectRaw("COALESCE(NULLIF(TRIM(cancellation_reason), ''), 'No reason provided') as reason, cancellation_type, COUNT(*) as count")
                ->groupBy('reason', 'cancellation_type')
                ->orderByDesc('count')
                ->get()
                ->map(function ($row) {
                    $reason = trim((string) $row->reason);
                    if (preg_match('/^\[LATE CANCELLATION\]\s*(.*)$/i', $reason, $matches)) {
                        $reason = trim($matches[1]);
                        $reason = $reason !== '' ? 'Late Cancellation - ' . $reason : 'Late Cancellation';
                    }
                    return [
                        'reason' => $reason !== '' ? $reason : 'No reason provided',
                        'cancellation_type' => $row->cancellation_type,
                        'count' => (int) $row->count,
                    ];
                });

            return [
                'by_service' => $byService,
                'top_addons' => $addonCounts,
                'cancellation_reasons' => $cancellationReasons,
            ];
        });

        return $this->success($data);
    }

    public function staffActivity(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', User::class);
        return $this->success($this->staffReports->activity($request->validated()));
    }

    public function staffActivityDetails(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', User::class);
        return response()->json(['data' => $this->staffReports->activityDetails($request->validated())]);
    }

    public function serviceRetailSummary(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', Appointment::class);
        $validated = $request->validated();
        [$start, $end] = $this->dateRange($validated);

        $appointments = Appointment::query()
            ->whereBetween('appointment_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotIn('status', ['cancelled', 'rejected', 'no_show'])
            ->whereHas('walkInSales')
            ->with(['pet:id,name,pet_id', 'service:id,name,category', 'walkInSales:id,appointment_id,receipt_number,total_amount,sold_at,voided_at'])
            ->select(['id', 'pet_id', 'service_id', 'appointment_date', 'booking_source', 'status'])
            ->orderByDesc('appointment_date')
            ->get()
            ->map(fn (Appointment $appointment) => [
                'id' => $appointment->id,
                'pet_name' => $appointment->pet?->name,
                'pet_code' => $appointment->pet?->pet_id,
                'service_name' => $appointment->service?->name,
                'service_category' => $appointment->service?->category,
                'booking_source' => $appointment->booking_source,
                'date' => optional($appointment->appointment_date)->toDateString(),
                'retail_sales' => $appointment->walkInSales->whereNull('voided_at')->values(),
            ]);

        return response()->json(['data' => $appointments->values()]);
    }

    public function commissions(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', User::class);
        return response()->json($this->staffReports->commissions($request->validated()));
    }

    public function staffAttendance(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', User::class);
        return response()->json($this->staffReports->attendance($request->validated()));
    }

    public function staffOptions()
    {
        $this->authorize('viewAny', User::class);
        return response()->json(['data' => $this->staffReports->options()]);
    }

    public function staffExport(ReportFilterRequest $request)
    {
        $this->authorize('viewAny', User::class);
        $filters = $request->validated();
        $groups = ($filters['group'] ?? 'all') === 'all' ? ['activity', 'attendance', 'commission'] : [$filters['group']];
        $scope = $filters['group'] ?? 'all';
        $format = $filters['format'] ?? 'csv';
        [$start, $end] = $this->staffReports->range($filters);
        $selectedStaff = isset($filters['staff_id']) ? User::find($filters['staff_id']) : null;
        $metadata = [
            'from' => $start->toDateString(),
            'to' => $end->toDateString(),
            'timezone' => StaffReportService::TIMEZONE,
            'staff_id' => $selectedStaff ? ($selectedStaff->display_id ?: $selectedStaff->name) : 'all',
            'staff_type' => $filters['staff_type'] ?? 'all',
            'service_id' => $filters['service_id'] ?? 'all',
            'status' => $filters['status'] ?? 'all',
            'appointment_status' => $filters['appointment_status'] ?? 'all',
        ];
        $summaries = [];
        foreach ($groups as $group) {
            $summaries[$group] = match ($group) {
                'activity' => $this->staffReports->activity($filters)['summary'],
                'attendance' => $this->staffReports->attendance($filters)['summary'],
                'commission' => $this->staffReports->commissions($filters)['summary'],
            };
        }
        $filename = 'staff_' . ($scope === 'all' ? 'full' : $scope) . '_' . $start->toDateString() . '_' . $end->toDateString() . '.' . $format;
        if ($format === 'csv') {
            return response()->streamDownload(function () use ($groups, $filters, $metadata, $summaries) {
                $output = fopen('php://output', 'w');
                fwrite($output, "\xEF\xBB\xBF");
                foreach ($groups as $group) {
                    fputcsv($output, ['Staff '.ucfirst($group).' Report']);
                    foreach ($metadata as $key => $value) fputcsv($output, [ucwords(str_replace('_', ' ', $key)), $value]);
                    foreach ($this->staffExportSummary($group, $summaries[$group]) as $key => $value) fputcsv($output, [$key, $value]);
                    fputcsv($output, $this->staffExportHeaders($group));
                    foreach ($this->staffExportRows($group, $filters) as $row) fputcsv($output, $row);
                    fputcsv($output, []);
                }
                fclose($output);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }
        $writer = new StaffReportPdfWriter('Staff '.($scope === 'all' ? 'Full' : ucfirst($scope)).' Report', $start->toDateString().' to '.$end->toDateString().' (Asia/Manila)');
        $writer->heading('Selected filters');
        foreach ($metadata as $key => $value) $writer->text(ucwords(str_replace('_', ' ', $key)).': '.$value);
        $rowCount = 0;
        foreach ($groups as $group) {
            $writer->blank();
            $writer->heading(ucfirst($group));
            foreach ($this->staffExportSummary($group, $summaries[$group]) as $key => $value) $writer->text($key.': '.$value);
            $headers = $this->staffExportHeaders($group);
            $groupCount = 0;
            $writer->startTable($headers);
            foreach ($this->staffExportRows($group, $filters) as $row) {
                if (++$rowCount > 20000) return response()->json(['message' => 'PDF export exceeds 20,000 records. Narrow the date range or use CSV.'], 422);
                $groupCount++;
                $writer->row($row);
            }
            $writer->endTable();
            if (!$groupCount) $writer->text('No records for the selected filters.');
        }
        return response($writer->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function staffExportHeaders(string $group): array
    {
        return match ($group) {
            'activity' => ['Staff ID', 'Staff', 'Type', 'Assigned', 'Completed', 'Cancelled', 'No-Show'],
            'attendance' => ['Date', 'Staff ID', 'Staff', 'Type', 'Time In (Manila)', 'Time Out (Manila)', 'Hours', 'Status', 'Recorded By', 'Recording Method'],
            'commission' => ['Date (Manila)', 'Staff ID', 'Staff', 'Type', 'Appointment', 'Service', 'Saved Base (PHP)', 'Saved Rate (%)', 'Saved Commission (PHP)'],
        };
    }

    private function staffExportSummary(string $group, array $summary): array
    {
        return match ($group) {
            'activity' => ['Staff members' => $summary['staff_count'], 'Assigned appointments' => $summary['assigned'], 'Completed appointments' => $summary['completed'], 'Cancelled appointments' => $summary['cancelled']],
            'attendance' => ['Attendance records' => $summary['count'], 'Completed shifts' => $summary['completed'], 'Distinct staff-days worked' => $summary['days_worked'], 'Recorded hours' => number_format($summary['total_seconds'] / 3600, 2, '.', ''), 'On duty' => $summary['on_duty'], 'Missing Time Out' => $summary['needs_review']],
            'commission' => ['Commission records' => $summary['count'], 'Saved base total (PHP)' => number_format($summary['total_base'], 2, '.', ''), 'Total commission (PHP)' => number_format($summary['total_commission'], 2, '.', ''), 'Average saved rate (%)' => number_format($summary['average_rate'], 2, '.', '')],
        };
    }

    private function staffExportRows(string $group, array $filters): \Generator
    {
        if ($group === 'activity') {
            foreach ($this->staffReports->activity($filters)['by_staff'] as $row) {
                yield [$row['display_id'] ?: '—', $row['name'], $row['staff_type'], $row['total'], $row['completed'], $row['cancelled'], $row['no_show']];
            }
            return;
        }
        if ($group === 'attendance') {
            foreach ($this->staffReports->attendanceRows($filters) as $row) {
                yield [$row['date'], $row['staff_display_id'] ?: '—', $row['staff_name'], $row['staff_type'], $this->manilaDateTime($row['time_in']), $this->manilaDateTime($row['time_out']), $row['duration_seconds'] === null ? '' : number_format($row['duration_seconds'] / 3600, 2, '.', ''), $row['status_label'], $row['recorded_by_name'] ?: '', $row['recording_method'] ?: ''];
            }
            return;
        }
        foreach ($this->staffReports->commissionQuery($filters)->lazy(200) as $row) {
            yield [
                $this->manilaDateTime($row->earned_at),
                $row->staff?->display_id ?: '—',
                $row->staff?->name,
                $row->staff?->staff_type,
                $row->appointment?->appointment_code ?: $row->appointment_id,
                $row->service?->name ?: 'Service unavailable',
                number_format($row->commission_base_amount, 2, '.', ''),
                number_format($row->rate_percent, 2, '.', ''),
                number_format($row->commission_amount, 2, '.', ''),
            ];
        }
    }

    private function manilaDateTime($value): string
    {
        return $value ? Carbon::parse($value)->setTimezone(StaffReportService::TIMEZONE)->format('Y-m-d H:i') : '';
    }
}
