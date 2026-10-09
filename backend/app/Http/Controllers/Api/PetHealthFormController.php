<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePetHealthFormRequest;
use App\Models\Appointment;
use App\Models\Pet;
use App\Models\PetHealthForm;
use App\Models\Service;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class PetHealthFormController extends Controller
{
    private const DOG_VACCINES = [
        'Rabies (Mandatory)',
        'Canine Distemper',
        'Infectious Canine Hepatitis (Adenovirus Type 1 or 2)',
        'Canine Parvovirus',
        'Canine Parainfluenza',
        'Leptospirosis',
        'Bordetella bronchiseptica (Kennel Cough)',
        'Canine Coronavirus',
        'Canine Influenza',
        'Lyme Disease',
    ];

    private const CAT_VACCINES = [
        'Rabies (Mandatory)',
        'Feline Panleukopenia (Distemper)',
        'Feline Calicivirus',
        'Feline Viral Rhinotracheitis (Herpesvirus-1)',
        'Chlamydia',
        'Feline Leukemia Virus (FeLV)',
        'Feline Immunodeficiency Virus (FIV)',
        'Bordetella',
    ];

    private function assessmentTable(): string
    {
        return (new PetHealthForm())->getTable();
    }

    private function allowedVaccinesFor(Pet $pet): array
    {
        $pet->loadMissing('speciesType');
        $speciesCode = strtoupper((string) ($pet->speciesType?->code ?? ''));

        return match ($speciesCode) {
            'D' => self::DOG_VACCINES,
            'C' => self::CAT_VACCINES,
            default => [],
        };
    }

    private function hasAssessmentColumn(string $column): bool
    {
        static $cache = [];
        $table = $this->assessmentTable();
        $key = $table . ':' . $column;

        if (!array_key_exists($key, $cache)) {
            $cache[$key] = Schema::hasColumn($table, $column);
        }

        return $cache[$key];
    }

    private function hasRabiesVaccine(?PetHealthForm $form): bool
    {
        if (!$form) {
            return false;
        }

        if ((bool) ($form->vaccine_rabies ?? false)) {
            return true;
        }

        $vaccines = $form->vaccines ?? [];
        if (is_string($vaccines)) {
            $decoded = json_decode($vaccines, true);
            $vaccines = is_array($decoded) ? $decoded : [$vaccines];
        }

        return collect((array) $vaccines)
            ->contains(fn ($name) => str_contains(strtolower((string) $name), 'rabies'));
    }

    private function normalizeVaccineLabel(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/\s+/', ' ', $normalized ?? '');
        $normalized = str_replace(['-', '_'], ' ', $normalized ?? '');
        $normalized = preg_replace('/[^a-z0-9\s\(\)]/', '', $normalized ?? '');
        return trim($normalized ?? '');
    }

    private function vaccinesAllowedForPet(array $submitted, array $allowed): bool
    {
        if (empty($submitted)) {
            return true;
        }

        $allowedNormalized = collect($allowed)
            ->map(fn ($name) => $this->normalizeVaccineLabel((string) $name))
            ->filter()
            ->values()
            ->all();

        foreach ($submitted as $name) {
            $candidate = $this->normalizeVaccineLabel((string) $name);
            if ($candidate === '') {
                continue;
            }

            $isMatch = collect($allowedNormalized)->contains(function ($allowedName) use ($candidate) {
                return $candidate === $allowedName
                    || str_contains($candidate, $allowedName)
                    || str_contains($allowedName, $candidate);
            });

            if (!$isMatch) {
                return false;
            }
        }

        return true;
    }

    private function requiresRabiesForService(?string $serviceId): bool
    {
        if (!$serviceId) {
            return false;
        }

        $category = Service::query()
            ->where('id', $serviceId)
            ->value('category');

        return in_array(strtolower((string) $category), ['daycare', 'hotel'], true);
    }

    private function filteredFormQuery(Request $request, Pet $pet)
    {
        $query = PetHealthForm::where('pet_id', $pet->id);

        if ($request->filled('appointment_id') && $this->hasAssessmentColumn('appointment_id')) {
            $query->where('appointment_id', $request->string('appointment_id'));
        }

        if ($request->filled('service_id') && $this->hasAssessmentColumn('service_id')) {
            $query->where('service_id', $request->string('service_id'));
        }

        if ($request->filled('owner_id') && $this->hasAssessmentColumn('owner_id')) {
            $query->where('owner_id', $request->string('owner_id'));
        }

        if ($request->filled('form_id')) {
            $query->where('id', $request->string('form_id'));
        }

        return $query;
    }

    private function formForPetOnDate(Pet $pet, Carbon $date): ?PetHealthForm
    {
        $start = $date->copy()->timezone('Asia/Manila')->startOfDay();
        $end = $date->copy()->timezone('Asia/Manila')->endOfDay();

        return PetHealthForm::query()
            ->where('pet_id', $pet->id)
            ->whereBetween('created_at', [$start, $end])
            ->orderByDesc('updated_at')
            ->first();
    }

    private function requestedAssessmentDate(Request $request, Pet $pet): Carbon
    {
        if ($request->filled('appointment_id')) {
            $appointmentCreatedAt = Appointment::query()
                ->where('id', $request->string('appointment_id'))
                ->where('pet_id', $pet->id)
                ->value('created_at');
            if ($appointmentCreatedAt) {
                return Carbon::parse($appointmentCreatedAt)->timezone('Asia/Manila');
            }
        }

        return Carbon::now('Asia/Manila');
    }

    // GET /my-pets/{pet}/health-form
    // Fetch the latest health form for a specific pet (optionally filtered).
    public function show(Request $request, Pet $pet)
    {
        $this->authorize('view', $pet);

        $isBookingLookup = $request->filled('service_id')
            && !$request->filled('appointment_id')
            && !$request->filled('form_id');
        $form = $isBookingLookup
            ? $this->formForPetOnDate($pet, Carbon::now('Asia/Manila'))
            : $this->filteredFormQuery($request, $pet)->orderByDesc('created_at')->first();

        if (!$form && !$request->filled('form_id')) {
            $form = $this->formForPetOnDate($pet, $this->requestedAssessmentDate($request, $pet));
        }

        return $this->success($form, 'Health form retrieved successfully.');
    }

    // GET /my-pets/{pet}/health-form/status
    // Lightweight status endpoint for fast booking checks.
    public function status(Request $request, Pet $pet)
    {
        $this->authorize('view', $pet);

        $form = $this->formForPetOnDate($pet, $this->requestedAssessmentDate($request, $pet));

        if (!$form) {
            return $this->success([
                'has_assessment' => false,
                'complete_today' => false,
                'has_ticks_or_flea' => false,
                'has_ticks' => false,
                'has_flea' => false,
                'has_rabies' => false,
                'missing_rabies' => true,
                'checked_at' => null,
            ], 'Health form status retrieved successfully.');
        }

        $checkedTimestamp = $form->updated_at && (!$form->created_at || $form->updated_at->greaterThan($form->created_at))
            ? $form->updated_at
            : ($form->created_at ?? $form->updated_at);
        $checkedAt = Carbon::parse($checkedTimestamp)->timezone('Asia/Manila');
        $expiresAt = $checkedAt->copy()->endOfDay();
        $isFresh = $checkedAt->isSameDay(Carbon::now('Asia/Manila'));
        $completeToday = (bool) (
            $form->is_friendly
            && $form->declaration_accepted
            && $isFresh
        );

        $hasTicks = (bool) ($form->has_ticks ?? false);
        $hasFlea = (bool) ($form->has_flea ?? false);

        return $this->success([
            'has_assessment' => true,
            'complete_today' => $completeToday,
            'has_ticks_or_flea' => $hasTicks || $hasFlea,
            'has_ticks' => $hasTicks,
            'has_flea' => $hasFlea,
            'has_rabies' => $this->hasRabiesVaccine($form),
            'missing_rabies' => !$this->hasRabiesVaccine($form),
            'checked_at' => optional($checkedTimestamp)->toISOString(),
            'expires_at' => $expiresAt->toISOString(),
        ], 'Health form status retrieved successfully.');
    }

    // GET /my-pets/{pet}/health-form/history
    // Fetch assessment history for a specific pet.
    public function history(Request $request, Pet $pet)
    {
        $this->authorize('view', $pet);

        $assignedAppointmentIds = [];
        $forms = $this->filteredFormQuery($request, $pet)
            ->with([
                'service:id,name,display_id,category',
                'appointment' => fn ($query) => $query
                    ->withTrashed()
                    ->select('id', 'appointment_code', 'service_id', 'hotel_suite_id', 'appointment_date', 'start_time', 'status', 'reference_number', 'special_instructions', 'size_label', 'hotel_nights', 'check_in_time', 'check_out_time', 'completed_at', 'created_at', 'deleted_at'),
                'appointment.service:id,name,display_id,category',
                'appointment.hotelSuite:id,name',
                'appointment.appointmentAddons:id,appointment_id,addon_id,price_charged',
                'appointment.appointmentAddons.serviceAddon:id,name',
            ])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(function (PetHealthForm $form) use (&$assignedAppointmentIds) {
                $form->setAttribute('service_name', $form->service?->name ?? $form->appointment?->service?->name);
                $appointment = $form->appointment;
                $appointmentCode = $appointment?->appointment_code;

                if ($appointment && !$appointment->trashed()) {
                    $assignedAppointmentIds[] = (string) $appointment->id;
                }

                // Assessments can be saved before booking creates the appointment.
                // Resolve those forms, and deleted duplicate links, to the nearest
                // active appointment for the same pet and service.
                if (!$appointmentCode || $appointment?->trashed()) {
                    $serviceId = $form->service_id ?: $form->service?->id ?: $appointment?->service_id;
                    $referenceAt = $appointment?->created_at ?: $form->created_at;
                    $candidateQuery = Appointment::query()
                        ->where('pet_id', $form->pet_id)
                        ->when($serviceId, fn ($query) => $query->where('service_id', $serviceId))
                        ->whereNull('deleted_at');

                    $candidates = $candidateQuery
                        ->get(['id', 'appointment_code', 'created_at']);

                    // Legacy forms may contain a service display ID or no service ID.
                    // If the strict service match has no result, match against the pet's
                    // active appointments rather than leaving the appointment ID blank.
                    if ($candidates->isEmpty() && $serviceId) {
                        $candidates = Appointment::query()
                            ->where('pet_id', $form->pet_id)
                            ->whereNull('deleted_at')
                            ->get(['id', 'appointment_code', 'created_at']);
                    }

                    $replacement = $candidates
                        ->reject(fn ($candidate) => in_array((string) $candidate->id, $assignedAppointmentIds, true))
                        ->sortBy(function ($candidate) use ($referenceAt) {
                            if (!$referenceAt || !$candidate->created_at) return PHP_INT_MAX;
                            return abs(Carbon::parse($candidate->created_at)->diffInSeconds(Carbon::parse($referenceAt), false));
                        })
                        ->first();

                    if ($replacement) {
                        $appointmentCode = $replacement->appointment_code ?: $appointmentCode;
                        $assignedAppointmentIds[] = (string) $replacement->id;
                    }
                }

                $form->setAttribute('appointment_code', $appointmentCode);
                return $form;
            })
            ->values();

        return $this->success(['forms' => $forms], 'Health form history retrieved successfully.');
    }

    // POST /my-pets/{pet}/health-form
    // Save a new assessment record for the specific pet.
    public function save(StorePetHealthFormRequest $request, Pet $pet)
    {
        $this->authorize('updateHealthForm', $pet);

        $validated = $request->validated();

        $appointmentId = $validated['appointment_id'] ?? null;
        $serviceId = $validated['service_id'] ?? null;
        if ($request->user()?->isGroomer() && !$appointmentId) {
            return $this->error('Groomers must link an assessment to their assigned appointment.', 422);
        }
        $ownerId = $pet->owner_id;
        $vaccines = array_values(array_filter((array) ($validated['vaccines'] ?? []), fn ($value) => is_string($value) && trim($value) !== ''));
        $vaccineRecords = collect((array) ($validated['vaccine_records'] ?? []))
            ->filter(fn ($date, $name) => is_string($name) && trim($name) !== '' && is_string($date) && trim($date) !== '')
            ->map(fn ($date) => Carbon::parse($date)->toDateString())
            ->all();
        $vaccineDate = $validated['vaccine_date'] ?? null;
        if (!$vaccineDate && !empty($vaccineRecords)) {
            $vaccineDate = collect(array_values($vaccineRecords))->sort()->first();
        }
        $allowedVaccines = $this->allowedVaccinesFor($pet);

        if ($appointmentId) {
            $appointment = Appointment::query()
                ->where('id', $appointmentId)
                ->where('pet_id', $pet->id)
                ->first();

            if (!$appointment) {
                return $this->error('Appointment not found for the selected pet.', 422);
            }

            if ($request->user()?->isGroomer()
                && ((string) $appointment->handled_by !== (string) $request->user()->id
                    || strtolower((string) $appointment->service?->category) !== 'grooming')) {
                return $this->error('Groomers may only save assessments for their assigned grooming appointments.', 403);
            }

            if ($serviceId && (string) $serviceId !== (string) $appointment->service_id) {
                return $this->error('Selected service does not match the linked appointment service.', 422);
            }

            $serviceId = $appointment->service_id;
            $ownerId = $appointment->booked_by_owner_id ?: $ownerId;
        }

        if (($validated['is_vaccinated'] ?? null) === 'Yes') {
            if (!$vaccineDate) {
                return $this->error('Please add the vaccine date.', 422);
            }

            if (!$vaccines) {
                return $this->error('Please select at least one applicable vaccine.', 422);
            }

            $hasRabies = collect($vaccines)
                ->contains(fn ($name) => str_contains(strtolower((string) $name), 'rabies'));
            if ($this->requiresRabiesForService($serviceId) && !$hasRabies) {
                return $this->error('Rabies vaccination is required for hotel/daycare services.', 422);
            }

            if ($allowedVaccines && !$this->vaccinesAllowedForPet($vaccines, $allowedVaccines)) {
                return $this->error('Please select only the vaccines applicable to this pet.', 422);
            }
        } else {
            $vaccines = [];
            $vaccineDate = null;
        }

        $payload = [
            'pet_id'               => $pet->id,
            'owner_id'             => $ownerId,
            'service_id'           => $serviceId,
            'appointment_id'       => $appointmentId,
            'is_vaccinated'        => $validated['is_vaccinated'] ?? null,
            'vaccine_date'         => $vaccineDate,
            'vaccines'             => $vaccines ?: null,
            'vaccine_records'      => !empty($vaccineRecords) ? $vaccineRecords : null,
            'vaccine_5in1'         => $validated['vaccine_5in1'] ?? false,
            'vaccine_rabies'       => collect($vaccines)->contains(fn ($name) => str_contains(strtolower((string) $name), 'rabies')),
            'vet_clinic_name'      => $validated['vet_clinic_name'] ?? null,
            'vet_contact_number'   => $validated['vet_contact_number'] ?? null,
            'is_friendly'          => $validated['is_friendly'] ?? null,
            'treat_preference'     => $validated['treat_preference'] ?? null,
            'allergies'            => $validated['allergies'] ?? null,
            'has_ticks'            => $validated['has_ticks'] ?? false,
            'has_flea'             => $validated['has_flea'] ?? false,
            'has_wound'            => $validated['has_wound'] ?? false,
            'has_mange'            => $validated['has_mange'] ?? false,
            'has_bald_spot'        => $validated['has_bald_spot'] ?? false,
            'has_skin_problem'     => $validated['has_skin_problem'] ?? false,
            'has_lameness'         => $validated['has_lameness'] ?? false,
            'has_eye_discharge'    => $validated['has_eye_discharge'] ?? false,
            'has_nasal_discharge'  => $validated['has_nasal_discharge'] ?? false,
            'has_ear_discharge'    => $validated['has_ear_discharge'] ?? false,
            'medical_conditions'   => $validated['medical_conditions'] ?? null,
            'declaration_accepted' => $validated['declaration_accepted'] ?? false,
            'certified_at'         => ($validated['declaration_accepted'] ?? false) ? Carbon::now() : null,
            'weight_kg'            => isset($validated['weight_kg']) ? (float) $validated['weight_kg'] : null,
        ];

        foreach (array_keys($payload) as $column) {
            if (!$this->hasAssessmentColumn($column)) {
                unset($payload[$column]);
            }
        }

        try {
            $form = $this->formForPetOnDate($pet, Carbon::now('Asia/Manila'));
            if ($form) {
                $payload['appointment_id'] = $form->appointment_id ?: ($payload['appointment_id'] ?? null);
                $form->fill($payload)->save();
            } else {
                $form = PetHealthForm::create($payload);
            }

            // Keep pet profile weight in sync with the latest assessment submission.
            if (array_key_exists('weight_kg', $validated) && $validated['weight_kg'] !== null) {
                $pet->update(['weight_kg' => $validated['weight_kg']]);
            }
        } catch (QueryException $exception) {
            $message = strtolower($exception->getMessage());
            if (
                (str_contains($message, 'pet_assessment_form') || str_contains($message, 'pet_health_forms'))
                && str_contains($message, 'appointment_id')
                && (str_contains($message, 'null value') || str_contains($message, 'not-null constraint'))
            ) {
                return $this->error('Unable to save assessment because appointment linkage is required by the current database schema. Please contact support to apply the latest migration.', 422);
            }

            if (str_contains($message, 'constraint') || str_contains($message, 'sqlstate[23')) {
                return $this->error('Unable to save pet assessment due to a database constraint. Please review required fields and try again.', 422);
            }

            report($exception);
            return $this->error('Failed to save pet assessment form due to a server error.', 500);
        }

        return $this->success($form, 'Health form saved successfully.');
    }

    // GET /my-pets/{pet}/health-form/pdf
    // Download the health form as PDF
    public function downloadPdf(Request $request, Pet $pet)
    {
        $this->authorize('view', $pet);

        $form = $this->filteredFormQuery($request, $pet)
            ->orderByDesc('created_at')
            ->first();

        if (!$form && !$request->filled('form_id')) {
            $form = $this->formForPetOnDate($pet, $this->requestedAssessmentDate($request, $pet));
        }

        if (!$form) {
            return $this->error('Health form not found. Please save the form first.', 404);
        }

        $form->loadMissing([
            'service:id,name,display_id,category',
            'appointment:id,appointment_code,service_id,hotel_suite_id,appointment_date,start_time,status,size_label,hotel_nights,check_out_time',
            'appointment.service:id,name,display_id,category',
            'appointment.hotelSuite:id,name',
            'appointment.appointmentAddons:id,appointment_id,addon_id,price_charged',
            'appointment.appointmentAddons.serviceAddon:id,name',
        ]);
        $pet->load(['speciesType', 'breed', 'owner']);

        $owner = $pet->owner;

        $category = strtolower((string) ($form->service?->category ?? $form->appointment?->service?->category ?? ''));
        $serviceName = strtolower((string) ($form->service?->name ?? $form->appointment?->service?->name ?? $form->service_name ?? ''));
        $serviceText = trim($category . ' ' . $serviceName);
        $isGrooming = str_contains($serviceText, 'groom')
            || str_contains($serviceText, 'fresh')
            || str_contains($serviceText, 'tidy')
            || str_contains($serviceText, 'glow')
            || str_contains($serviceText, 'glam');
        $paper = $isGrooming ? 'a4' : 'legal';

        $pdf = Pdf::loadView('pdf.pet-health-form', compact('pet', 'form', 'owner'))
            ->setPaper($paper, 'portrait');

        return $pdf->download("TheFurClub-PetAssessment-{$pet->name}.pdf");
    }
}
