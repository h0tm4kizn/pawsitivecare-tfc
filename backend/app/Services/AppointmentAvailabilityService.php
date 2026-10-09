<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\HotelSuite;
use App\Models\Service;
use App\Models\ServiceTier;
use App\Models\ShopHoursSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AppointmentAvailabilityService
{
    public function __construct(private readonly HotelClusterAllocator $hotelAllocator)
    {
    }

    public function availableSlots(Request $request): array
    {
        $date = $request->query('date');
        $serviceId = $request->query('service_id');
        if (!$date || !$serviceId) {
            return ['status' => 422, 'data' => null, 'message' => 'date and service_id are required'];
        }

        $cacheKey = 'appointments:available-slots:v2:' . md5(json_encode([
            'date' => $date, 'service_id' => $serviceId,
            'pets_count' => (int) $request->query('pets_count', 1),
            'size_label' => (string) $request->query('size_label', ''),
            'duration_tier' => (string) $request->query('duration_tier', ''),
            'shop_hours' => ShopHoursSetting::get('shop_hours', []),
            'hotel_schedule' => ShopHoursSetting::get('schedule.hotel', []),
            'blocked_dates' => ShopHoursSetting::get('blocked_dates', []),
            'appointments_updated_at' => Appointment::query()->whereDate('appointment_date', $date)->max('updated_at'),
            'walk_in' => $request->boolean('walk_in'),
            'current_time' => $date === now('Asia/Manila')->toDateString() ? now('Asia/Manila')->format('Y-m-d H:i') : null,
        ]));
        $ttl = $date === now('Asia/Manila')->toDateString() ? 15 : 60;

        return Cache::remember($cacheKey, $ttl, function () use ($request, $date, $serviceId) {
            $service = Service::find($serviceId);
            if (!$service) {
                return ['status' => 404, 'data' => null, 'message' => 'Service not found.'];
            }
            $category = $service->category;
            if (strtolower((string) $category) === 'grooming') {
                return $this->groomingAvailability($date, $serviceId, $request->query('size_label'), $request->boolean('walk_in'));
            }
            if (in_array($date, ShopHoursSetting::get('blocked_dates', []), true)) {
                return ['status' => 200, 'data' => ['slots' => [], 'reason' => 'blocked'], 'message' => 'No slots - clinic is closed this date.'];
            }
            if (strtolower((string) $category) === 'hotel') {
                $slots = $this->hotelCheckInSlotsForDate($date);
                return ['status' => 200, 'data' => [
                    'slots' => $slots,
                    'operating_hours' => $this->hotelOperatingHoursForDate($date),
                    'reason' => $slots ? null : 'closed',
                ],
                    'message' => $slots ? 'Available slots retrieved successfully.' : 'No Hotel Suite check-in times are available for this date.'];
            }

            $days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            $keys = ['sunday'=>'sun','monday'=>'mon','tuesday'=>'tue','wednesday'=>'wed','thursday'=>'thu','friday'=>'fri','saturday'=>'sat'];
            $day = $days[(int) date('w', strtotime($date))];
            $schedule = ShopHoursSetting::get("schedule.{$category}", []);
            $open = $close = null;
            $dayStr = ShopHoursSetting::get('shop_hours', [])[$keys[$day] ?? ''] ?? null;
            if ($dayStr !== null) {
                if (strtolower(trim($dayStr)) === 'closed') {
                    return ['status'=>200, 'data'=>['slots'=>[], 'reason'=>'closed'], 'message'=>'Clinic is closed on this day.'];
                }
                $normalized = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $dayStr);
                if (preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $normalized, $m)) {
                    $open = date('H:i:s', strtotime("{$m[1]} {$m[2]}"));
                    $close = date('H:i:s', strtotime("{$m[3]} {$m[4]}"));
                }
            }
            if ($open === null) {
                if (empty($schedule)) return ['status'=>200, 'data'=>['slots'=>[]], 'message'=>'No schedule configured for this service.'];
                if (!in_array((int) date('w', strtotime($date)), $schedule['days'] ?? [])) {
                    return ['status'=>200, 'data'=>['slots'=>[], 'reason'=>'closed'], 'message'=>'Clinic is closed on this day.'];
                }
                $open = ($schedule['open'] ?? '09:00') . ':00';
                $close = ($schedule['close'] ?? '17:00') . ':00';
            }
            $durationTier = $request->query('duration_tier');
            if ($category === 'daycare') {
                $close = ['hourly'=>'17:00:00','half_day'=>'16:00:00','full_day'=>'13:00:00'][$durationTier] ?? $close;
            }
            $interval = (int) ($schedule['interval_mins'] ?? 60);
            $allSlots = [];
            for ($ts = strtotime("{$date} {$open}"); $ts < strtotime("{$date} {$close}"); $ts += $interval * 60) $allSlots[] = date('H:i:s', $ts);
            $requiredUnits = max(1, (int) $request->query('pets_count', 1));
            $sizeLabel = $request->query('size_label');
            if ($category === 'daycare') {
                $owner = $request->user()?->owner?->id ?? \App\Models\Owner::where('email', $request->user()?->email)->value('id');
                $bookings = Appointment::query()->where('appointment_date', $date)->whereNotIn('status', ['cancelled','completed','no_show','rejected'])
                    ->whereHas('service', fn($q) => $q->where('category', 'daycare'))
                    ->get(['booked_by_owner_id','start_time','service_id','size_label','daycare_duration']);
                $available = array_values(array_filter($allSlots, fn($slot) => $this->daycareSlotIsAvailable($date, $slot, $durationTier, $owner, $requiredUnits, $bookings)));
            } else {
                $bookings = Appointment::where('appointment_date', $date)->whereNotIn('status', ['cancelled','completed','no_show','rejected'])
                    ->whereHas('service', fn($q) => $q->where('category', 'grooming'))->get(['id','appointment_date','start_time','service_id','size_label']);
                $available = array_values(array_filter($allSlots, fn($slot) => !$this->hasSlotConflict($date, $slot, $serviceId, $sizeLabel, null, $requiredUnits, $bookings)));
            }
            if ($date === now('Asia/Manila')->toDateString()) {
                $now = now('Asia/Manila')->format('H:i:s');
                $available = array_values(array_filter($available, fn($slot) => $slot > $now));
            }
            return ['status'=>200, 'data'=>['slots'=>$available], 'message'=>'Available slots retrieved successfully.'];
        });
    }

    /** Serialize every Grooming writer on one shared database lock. */
    public function lockGroomingCapacityForUpdate(): void
    {
        $connection = DB::connection();
        if ($connection->getDriverName() === 'pgsql') {
            $connection->select('SELECT pg_advisory_xact_lock(2026100902)');
            return;
        }

        Service::query()
            ->whereRaw('LOWER(category) = ?', ['grooming'])
            ->orderBy('id')
            ->lockForUpdate()
            ->first(['id']);
    }

    private function groomingAvailability(string $date, string $serviceId, ?string $sizeLabel, bool $includeWalkIn): array
    {
        try {
            $day = Carbon::createFromFormat('!Y-m-d', $date, 'Asia/Manila');
        } catch (\Throwable) {
            $day = null;
        }
        if (!$day || $day->format('Y-m-d') !== $date || $date < now('Asia/Manila')->toDateString()) {
            return ['status' => 200, 'data' => ['slots' => [], 'slot_statuses' => [], 'reason' => 'past'], 'message' => 'No Grooming times are available for this date.'];
        }
        if (in_array($date, ShopHoursSetting::get('blocked_dates', []), true)) {
            return ['status' => 200, 'data' => ['slots' => [], 'slot_statuses' => [], 'reason' => 'blocked'], 'message' => 'No slots - clinic is closed this date.'];
        }

        $hours = $this->shopHoursForDate($day, 'grooming');
        if (!$hours) {
            return ['status' => 200, 'data' => ['slots' => [], 'slot_statuses' => [], 'reason' => 'closed'], 'message' => 'Clinic is closed on this day.'];
        }

        [$open, $close] = $hours;
        $allSlots = [];
        for ($slot = $open->copy(); $slot->copy()->addHour()->lessThanOrEqualTo($close); $slot->addHour()) {
            $allSlots[] = $slot->copy();
        }

        $bookings = Appointment::query()
            ->whereNull('deleted_at')
            ->whereDate('appointment_date', $date)
            ->whereHas('service', fn ($query) => $query->whereRaw('LOWER(category) = ?', ['grooming']))
            ->where(function ($query) {
                $query->whereNotIn('status', ['cancelled', 'completed', 'no_show', 'rejected'])
                    ->where(function ($hold) {
                        $hold->where('status', '!=', 'pending')
                            ->orWhereNull('capacity_hold_expires_at')
                            ->orWhere('capacity_hold_expires_at', '>', now('Asia/Manila'));
                    });
            })
            ->get(['id', 'appointment_date', 'start_time', 'service_id', 'size_label', 'status', 'capacity_hold_expires_at']);

        $now = now('Asia/Manila');
        $slotStatuses = [];
        foreach ($allSlots as $slot) {
            if ($date === $now->toDateString() && !$slot->greaterThan($now)) {
                continue;
            }
            $time = $slot->format('H:i:s');
            $full = $this->hasSlotConflict($date, $time, $serviceId, $sizeLabel, null, 1, $bookings);
            $slotStatuses[] = ['time' => $time, 'status' => $full ? 'full' : 'available'];
        }

        $available = array_values(array_map(
            fn (array $slot) => $slot['time'],
            array_filter($slotStatuses, fn (array $slot) => $slot['status'] === 'available')
        ));
        $walkInSlot = null;
        $walkInStatus = null;
        if ($includeWalkIn && $date === $now->toDateString()) {
            $immediateStart = $now->copy()->startOfMinute();
            if ($immediateStart->greaterThanOrEqualTo($open) && $immediateStart->copy()->addHour()->lessThanOrEqualTo($close)) {
                $full = $this->hasSlotConflict($date, $immediateStart->format('H:i:s'), $serviceId, $sizeLabel, null, 1, $bookings);
                $walkInStatus = $full ? 'full' : 'available';
                if (!$full) {
                    $walkInSlot = $immediateStart->format('H:i:s');
                }
            }
        }

        $hasFutureSlots = count($slotStatuses) > 0;
        $reason = $hasFutureSlots && !$available ? 'full' : null;
        if (!$hasFutureSlots && $walkInStatus !== 'available') {
            $reason = 'no_slots';
        }

        return [
            'status' => 200,
            'data' => [
                'slots' => $available,
                'slot_statuses' => $slotStatuses,
                'walk_in_slot' => $walkInSlot,
                'walk_in_status' => $walkInStatus,
                'reason' => $reason,
            ],
            'message' => 'Grooming availability retrieved successfully.',
        ];
    }

    private function shopHoursForDate(Carbon $day, string $category): ?array
    {
        $dayKey = strtolower($day->format('D'));
        $hoursText = ShopHoursSetting::get('shop_hours', [])[$dayKey] ?? null;
        if ($hoursText !== null) {
            if (strtolower(trim((string) $hoursText)) === 'closed') {
                return null;
            }
            $normalized = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $hoursText);
            if (preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $normalized, $matches)) {
                try {
                    $open = Carbon::createFromFormat('g:i A', strtoupper($matches[1] . ' ' . $matches[2]), 'Asia/Manila')->setDate($day->year, $day->month, $day->day);
                    $close = Carbon::createFromFormat('g:i A', strtoupper($matches[3] . ' ' . $matches[4]), 'Asia/Manila')->setDate($day->year, $day->month, $day->day);
                    return $close->greaterThan($open) ? [$open, $close] : null;
                } catch (\Throwable) {
                    return null;
                }
            }
            return null;
        }

        $schedule = ShopHoursSetting::get("schedule.{$category}", []);
        if (!$schedule || !in_array($day->dayOfWeek, array_map('intval', $schedule['days'] ?? []), true)) {
            return null;
        }
        try {
            $open = Carbon::createFromFormat('!H:i', (string) ($schedule['open'] ?? '09:00'), 'Asia/Manila')->setDate($day->year, $day->month, $day->day);
            $close = Carbon::createFromFormat('!H:i', (string) ($schedule['close'] ?? '17:00'), 'Asia/Manila')->setDate($day->year, $day->month, $day->day);
            return $close->greaterThan($open) ? [$open, $close] : null;
        } catch (\Throwable) {
            return null;
        }
    }

    public function isValidGroomingStart(string $date, ?string $time): bool
    {
        try {
            $day = Carbon::createFromFormat('!Y-m-d', substr($date, 0, 10), 'Asia/Manila');
        } catch (\Throwable) {
            return false;
        }
        if (!$day || $day->format('Y-m-d') !== substr($date, 0, 10)
            || in_array($day->toDateString(), ShopHoursSetting::get('blocked_dates', []), true)) {
            return false;
        }
        $hours = $this->shopHoursForDate($day, 'grooming');
        if (!$hours) {
            return false;
        }
        try {
            $normalizedTime = $this->normalizeClockTime($time);
            if (!preg_match('/^\d{2}:\d{2}:\d{2}$/', $normalizedTime)) {
                return false;
            }
            $start = Carbon::createFromFormat('!Y-m-d H:i:s', $day->toDateString() . ' ' . $normalizedTime, 'Asia/Manila');
        } catch (\Throwable) {
            return false;
        }
        [$open, $close] = $hours;
        return $start->greaterThanOrEqualTo($open)
            && $start->copy()->addHour()->lessThanOrEqualTo($close)
            && abs($open->diffInMinutes($start, false)) % 60 === 0;
    }

    public function isImmediateGroomingWalkIn(string $date, ?string $time): bool
    {
        $now = now('Asia/Manila');
        if (substr($date, 0, 10) !== $now->toDateString()
            || in_array($now->toDateString(), ShopHoursSetting::get('blocked_dates', []), true)) {
            return false;
        }
        $day = $now->copy()->startOfDay();
        $hours = $this->shopHoursForDate($day, 'grooming');
        if (!$hours) {
            return false;
        }
        try {
            $requested = Carbon::parse($date . ' ' . $this->normalizeClockTime($time), 'Asia/Manila');
        } catch (\Throwable) {
            return false;
        }
        [$open, $close] = $hours;
        return abs($requested->diffInSeconds($now, false)) <= 300
            && $now->greaterThanOrEqualTo($open)
            && $now->copy()->addHour()->lessThanOrEqualTo($close);
    }

    public function hotelCalendarAvailability(string $serviceId, string $month, ?string $suiteId, ?string $excludeId, ?string $petId): array
    {
        [$year, $mon] = explode('-', $month);
        $daysInMonth = (int) date('t', mktime(0, 0, 0, (int)$mon, 1, (int)$year));
        $blocked = ShopHoursSetting::get('blocked_dates', []);
        $monthStart = sprintf('%04d-%02d-01', $year, $mon);
        $monthEnd = date('Y-m-d', strtotime($monthStart . ' +1 month'));
        $suite = $suiteId ? HotelSuite::find($suiteId) : null;
        $cluster = $this->hotelAllocator->clusterFromSuiteName($suite?->name);
        $ownerId = $petId ? \App\Models\Pet::whereKey($petId)->value('owner_id') : null;
        $datesInMonth = [];
        for ($d=1; $d <= $daysInMonth; $d++) $datesInMonth[] = sprintf('%04d-%02d-%02d', $year, $mon, $d);
        $inventory = $cluster ? $this->hotelAllocator->clusterInventoryByDate($cluster, $datesInMonth, $ownerId, $excludeId) : [];
        $petBookings = $petId ? Appointment::where('pet_id',$petId)->whereNotIn('status',['cancelled','completed','no_show','rejected'])
            ->where(fn($q) => $q->where('status','!=','pending')->orWhere('capacity_hold_expires_at','>',now('Asia/Manila')))
            ->whereHas('service',fn($q)=>$q->where('category','hotel'))->where(function($q) use($monthStart,$monthEnd) {
                $q->where(fn($x)=>$x->where('appointment_date','<',$monthEnd)->whereRaw($this->hotelStayEndsAfterSql(),[$monthStart]))
                  ->orWhere(fn($x)=>$x->whereNotNull('actual_check_in_at')->whereNull('actual_check_out_at')->where('actual_check_in_at','<=',now('Asia/Manila')));
            })->when($excludeId,fn($q)=>$q->where('id','!=',$excludeId))->get(['id','appointment_date','hotel_nights','actual_check_in_at','actual_check_out_at']) : collect();
        $dates = [];
        foreach ($datesInMonth as $date) {
            if (in_array($date,$blocked,true) || !$this->hotelCheckInSlotsForDate($date)) { $dates[]=['date'=>$date,'status'=>'closed']; continue; }
            $occupied = false;
            foreach ($petBookings as $booking) {
                if ($booking->actual_check_in_at && !$booking->actual_check_out_at && $booking->actual_check_in_at->lte(now('Asia/Manila')) && $date >= $booking->actual_check_in_at->timezone('Asia/Manila')->toDateString()) { $occupied=true; break; }
                $checkIn = is_string($booking->appointment_date) ? substr($booking->appointment_date,0,10) : $booking->appointment_date->format('Y-m-d');
                $checkOut = date('Y-m-d', strtotime($checkIn.' +'.max(1,(int)($booking->hotel_nights??1)).' days'));
                if ((!$booking->actual_check_out_at || $booking->actual_check_out_at->timezone('Asia/Manila')->toDateString() > $date) && $date >= $checkIn && $date < $checkOut) {$occupied=true; break;}
            }
            if ($occupied) {$dates[]=['date'=>$date,'status'=>'unavailable','reason'=>'pet_overlap']; continue;}
            $day = $inventory[$date] ?? ['capacity'=>0,'occupied'=>0,'available'=>0];
            $dates[]=['date'=>$date,'status'=>$day['available']>0?'available':'full','cluster'=>$cluster,'capacity'=>$day['capacity'],'occupied'=>$day['occupied'],'available'=>$day['available']];
        }
        return ['status'=>200,'data'=>['dates'=>$dates,'check_in_slots'=>$this->hotelCheckInSlotsForDate(now('Asia/Manila')->toDateString())],'message'=>'Hotel calendar availability retrieved.'];
    }

    public function daycareSlotAvailabilityError(string $date,string $startTime,?string $tier,string $ownerId,int $pets=1,?string $exclude=null): ?string
    {
        $start=Carbon::parse($date.' '.$this->normalizeClockTime($startTime),'Asia/Manila'); $end=$start->copy()->addMinutes($this->daycareDurationMinutesForTier($tier)); $overlap=0;
        $appointments=Appointment::where('appointment_date',$date)->whereNotIn('status',['cancelled','completed','no_show','rejected'])->when($exclude,fn($q)=>$q->where('id','!=',$exclude))->whereHas('service',fn($q)=>$q->where('category','daycare'))->get(['booked_by_owner_id','start_time','service_id','size_label','daycare_duration']);
        foreach($appointments as $a){if(!$a->start_time)continue;$s=Carbon::parse($date.' '.$this->normalizeClockTime($a->start_time),'Asia/Manila');$e=$s->copy()->addMinutes($a->daycare_duration?$this->daycareDurationMinutesForTier($a->daycare_duration):$this->serviceDurationMinutes((string)$a->service_id,$a->size_label));if($start->lt($e)&&$end->gt($s)){if((string)$a->booked_by_owner_id!==(string)$ownerId)return 'This daycare time range is reserved by another client.';$overlap++;}}
        return $overlap+max(1,$pets)>3?'A maximum of three pets may be booked in one overlapping daycare time range.':null;
    }

    public function hasSlotConflict(string $date,string $start,string $serviceId,?string $size=null,?string $exclude=null,int $units=1,?Collection $preloaded=null): bool
    {
        $service=Service::find($serviceId); if(!$service)return true;
        $requested=Carbon::parse($date.' '.$this->normalizeClockTime($start),'Asia/Manila');$end=$requested->copy()->addMinutes($this->serviceDurationMinutes($serviceId,$size));$cat=strtolower((string)$service->category);
        if ($preloaded !== null) {
            $appointments = $exclude ? $preloaded->where('id', '!=', $exclude) : $preloaded;
            $appointments = $appointments->filter(fn ($appointment) => $this->reservesCapacity($appointment));
        } else {
            $query = Appointment::where('appointment_date',$date)
                ->whereNotIn('status',['cancelled','completed','no_show','rejected'])
                ->where(fn($q) => $q->where('status','!=','pending')->orWhereNull('capacity_hold_expires_at')->orWhere('capacity_hold_expires_at','>',now('Asia/Manila')));
            if ($exclude) $query->where('id','!=',$exclude);
            if ($cat === 'grooming' || $cat === 'daycare') {
                $query->whereHas('service',fn($q)=>$q->where('category',$cat));
            } else {
                $query->where('service_id',$serviceId);
            }
            $appointments = $query->get(['id','appointment_date','start_time','service_id','size_label']);
        }
        foreach($appointments as $a){if(!$a->start_time)continue;$s=Carbon::parse($date.' '.$this->normalizeClockTime($a->start_time),'Asia/Manila');$e=$s->copy()->addMinutes($this->serviceDurationMinutes((string)$a->service_id,$a->size_label));if($requested->lt($e)&&$end->gt($s))return true;}
        return false;
    }

    private function reservesCapacity(Appointment $appointment): bool
    {
        $status = strtolower((string) $appointment->status);
        if (in_array($status, ['cancelled', 'completed', 'no_show', 'rejected'], true)) {
            return false;
        }
        if ($status !== 'pending' || !$appointment->capacity_hold_expires_at) {
            return true;
        }
        return Carbon::parse($appointment->capacity_hold_expires_at)->isAfter(now('Asia/Manila'));
    }

    public function validateHotelStayAvailability(Appointment $appointment,string $checkIn,int $nights,string $suiteId,?string $petSize=null): ?string
    {
        if($checkIn<now('Asia/Manila')->toDateString())return 'Hotel check-in date must be today or in the future.';
        if($nights<1||$nights>30)return 'Hotel stay length must be between 1 and 30 nights.';
        $suite=HotelSuite::find($suiteId);if(!$suite)return 'Selected hotel suite was not found.';if(!$suite->is_available)return 'No Hotel Suite is available for the selected dates. Please choose another date or suite.';$cluster=$this->hotelAllocator->clusterFromSuiteName($suite->name);if(!$cluster)return 'Selected hotel suite is not assigned to a configured occupancy cluster.';
        $appointment->loadMissing('pet.speciesType');
        $species=$this->hotelAllocator->normalizeSpecies($appointment->pet?->speciesType?->name??$appointment->pet?->speciesType?->code);
        $confirmedSize=$this->hotelAllocator->normalizeConfirmedPetSize($petSize??$appointment->pet_size,$species);
        $dogSize=$species==='dog'?$this->hotelAllocator->normalizeDogSize($confirmedSize):null;
        if(!$species||!$confirmedSize||!$this->hotelAllocator->validateSuiteSelection($species,$dogSize,$suite->name))return 'Selected hotel suite no longer matches the pet species/size rules.';
        $blocked=ShopHoursSetting::get('blocked_dates',[]);$hours=ShopHoursSetting::get('shop_hours',[]);
        $days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];$keys=['sunday'=>'sun','monday'=>'mon','tuesday'=>'tue','wednesday'=>'wed','thursday'=>'thu','friday'=>'fri','saturday'=>'sat'];
        // Keep the existing range semantics here; the controller's historical implementation
        // intentionally used the same check-in boundary behavior.
        $checkOut=Carbon::parse($checkIn,'Asia/Manila')->addDays($nights)->toDateString();
        for($date=$checkIn;$date<$checkOut;$date=Carbon::parse($date,'Asia/Manila')->addDay()->toDateString()){
            if(in_array($date,$blocked,true))return 'Selected stay includes a closed date.';
            $day=$days[(int)date('w',strtotime($date))]??null;$key=$day?($keys[$day]??null):null;$dayHours=$key?($hours[$key]??null):null;
            if($dayHours!==null&&strtolower(trim((string)$dayHours))==='closed')return 'Selected stay includes a closed date.';
        }
        $inventory=$this->hotelAllocator->clusterInventory($cluster,$checkIn,$nights,$appointment->booked_by_owner_id,(string)$appointment->id);if(($inventory['available']??0)<=0)return 'No Hotel Suite is available for the selected dates. Please choose another date or suite.';
        if($cluster==='D'&&$appointment->booked_by_owner_id&&$this->hotelAllocator->householdPetCount((string)$appointment->booked_by_owner_id,$checkIn,$nights,(string)$appointment->id)>=5)return 'The VIPurr Villa allows a maximum of 5 cats per household unit.';
        if($this->hasOverlappingHotelBooking((string)$appointment->pet_id,$checkIn,$nights,(string)$appointment->id))return 'This pet already has a hotel booking that overlaps the selected dates.';
        return null;
    }

    public function hotelCheckInSlotsForDate(string $date,?Carbon $now=null): array
    {
        $date=substr($date,0,10);
        $operatingHours = $this->hotelOperatingHoursForDate($date);
        if (!$operatingHours) return [];
        try {
            $checkIn = Carbon::createFromFormat('!Y-m-d', $date, 'Asia/Manila');
            $open = Carbon::createFromFormat('!H:i', $operatingHours['open'], 'Asia/Manila')->setDate($checkIn->year, $checkIn->month, $checkIn->day);
            $close = Carbon::createFromFormat('!H:i', $operatingHours['close'], 'Asia/Manila')->setDate($checkIn->year, $checkIn->month, $checkIn->day);
        } catch (\Throwable) {
            return [];
        }
        $now=($now??now('Asia/Manila'))->copy()->setTimezone('Asia/Manila');$slots=[];for($slot=$open->copy();$slot->lessThan($close);$slot->addMinutes(30))if($date!==$now->toDateString()||$slot->greaterThan($now))$slots[]=$slot->format('H:i:s');return $slots;
    }

    public function hotelOperatingHoursForDate(string $date): ?array
    {
        $date = substr($date, 0, 10);
        try {
            $checkIn = Carbon::createFromFormat('!Y-m-d', $date, 'Asia/Manila');
        } catch (\Throwable) {
            return null;
        }
        if (!$checkIn || $checkIn->format('Y-m-d') !== $date
            || in_array($date, ShopHoursSetting::get('blocked_dates', []), true)) {
            return null;
        }

        $schedule = ShopHoursSetting::get('schedule.hotel', []);
        if (!empty($schedule['days'])
            && !in_array($checkIn->dayOfWeek, array_map('intval', $schedule['days']), true)) {
            return null;
        }

        $hours = ShopHoursSetting::get('shop_hours', [])[strtolower($checkIn->format('D'))] ?? null;
        if (!$hours || strtolower(trim((string) $hours)) === 'closed') {
            return null;
        }
        $hours = preg_replace('/[\x{2013}\x{2014}]/u', '-', (string) $hours);
        if (!preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $hours, $matches)) {
            return null;
        }

        try {
            $open = Carbon::createFromFormat('g:i A', strtoupper($matches[1] . ' ' . $matches[2]), 'Asia/Manila');
            $close = Carbon::createFromFormat('g:i A', strtoupper($matches[3] . ' ' . $matches[4]), 'Asia/Manila');
        } catch (\Throwable) {
            return null;
        }
        if (!$open || !$close || !$close->greaterThan($open)) {
            return null;
        }

        return ['open' => $open->format('H:i'), 'close' => $close->format('H:i')];
    }

    public function isHotelCheckInTimeWithinOperatingHours(string $date, ?string $time): bool
    {
        if (!$time) {
            return false;
        }
        $hours = $this->hotelOperatingHoursForDate($date);
        if (!$hours) {
            return false;
        }

        $normalizedTime = substr($this->normalizeClockTime($time), 0, 5);
        return $normalizedTime >= $hours['open'] && $normalizedTime < $hours['close'];
    }

    private function daycareSlotIsAvailable(string $date,string $slot,?string $tier,$owner,int $pets,Collection $appointments): bool
    { $start=Carbon::parse($date.' '.$this->normalizeClockTime($slot),'Asia/Manila');$end=$start->copy()->addMinutes($this->daycareDurationMinutesForTier($tier));$count=0;foreach($appointments as $a){if(!$a->start_time)continue;$s=Carbon::parse($date.' '.$this->normalizeClockTime($a->start_time),'Asia/Manila');$e=$s->copy()->addMinutes($a->daycare_duration?$this->daycareDurationMinutesForTier($a->daycare_duration):$this->serviceDurationMinutes((string)$a->service_id,$a->size_label));if($start->lt($e)&&$end->gt($s)){if(!$owner||(string)$a->booked_by_owner_id!==(string)$owner)return false;$count++;}}return $count+max(1,$pets)<=3; }
    private function daycareDurationMinutesForTier(?string $tier): int { return match($tier){ 'half_day'=>240,'full_day'=>480,default=>60 }; }
    public function normalizeClockTime(?string $time): string { $value=substr((string)$time,0,8);return strlen($value)===5?$value.':00':$value; }
    private function serviceDurationMinutes(string $id,?string $size=null): int { if(strtolower((string)Service::whereKey($id)->value('category'))==='grooming')return 60;$q=ServiceTier::where('service_id',$id);$tier=$size?(clone $q)->whereRaw('LOWER(size_label) = ?',[strtolower(trim($size))])->first():null;$hours=(float)($tier?->duration_hours??$q->max('duration_hours'));return $hours>0?max(15,(int)round($hours*60)):60; }
    public function hotelStayEndsAfterSql(): string { return DB::connection()->getDriverName()==='sqlite'?"date(appointment_date, '+' || MAX(COALESCE(hotel_nights, 1), 1) || ' days') > ?":"appointment_date + (GREATEST(COALESCE(hotel_nights,1),1) * INTERVAL '1 day') > ?"; }
    private function hasOverlappingHotelBooking(string $pet,string $checkIn,int $nights,?string $exclude): bool { $out=Carbon::parse($checkIn,'Asia/Manila')->addDays(max(1,$nights))->toDateString();return Appointment::where('pet_id',$pet)->when($exclude,fn($q)=>$q->whereKeyNot($exclude))->whereNotIn('status',['cancelled','completed','no_show','rejected'])->whereHas('service',fn($q)=>$q->where('category','hotel'))->where('appointment_date','<',$out)->whereRaw($this->hotelStayEndsAfterSql(),[$checkIn])->exists(); }
}
