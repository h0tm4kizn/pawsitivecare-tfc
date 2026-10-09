<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @page { size: A4; margin: 8mm 12mm 7mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 7pt; color: #000; background: #fff; line-height: 1.15; }
    .document-header { position: relative; height: 24mm; padding-top: 1mm; }
    .brand-mark { position: absolute; top: 0; right: 0; width: 14mm; height: 14mm; object-fit: contain; }
    .title { text-align: center; font-weight: bold; font-size: 16pt; line-height: 1.15; }
    .station { text-align: center; font-weight: bold; font-size: 10pt; margin-top: 2mm; }
    .contact { text-align: center; font-size: 8pt; margin-top: 1.2mm; }
    .section { margin-top: 1.2mm; }
    .section-title { font-weight: bold; font-size: 8pt; text-transform: uppercase; letter-spacing: .25pt; border-bottom: .25mm solid #000; padding-bottom: .7mm; margin-bottom: 1.1mm; }
    table { width: 100%; border-collapse: collapse; }
    tr { page-break-inside: avoid; }
    td { vertical-align: top; }
    .half { width: 50%; }
    .label { font-weight: bold; white-space: nowrap; }
    .line { border-bottom: .25mm solid #000; height: auto; min-height: 4mm; padding: 0 1mm; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .field td { padding: .55mm 1.5mm .65mm 0; }
    .check { display: inline-block; width: 3.2mm; height: 3.2mm; border: .25mm solid #000; margin-right: 1.5mm; vertical-align: -.8mm; text-align: center; font-size: 7pt; line-height: 2.8mm; }
    .choice { margin-right: 7mm; white-space: nowrap; }
    .small { font-size: 7pt; }
    .bold { font-weight: bold; }
    .muted { color: #222; }
    .grid td { padding: .55mm 3mm .55mm 0; }
    .two-policy td { width: 50%; padding-right: 6mm; }
    .policy-title { font-weight: bold; margin-bottom: .6mm; }
    .policy { margin-bottom: 1.2mm; padding-left: 1mm; }
    .breakable { word-break: break-word; }
    .extras-label { width: 30mm; }
  </style>
</head>
<body>
@php
  $service = $form->service ?? $form->appointment?->service;
  $serviceCategory = strtolower((string) ($service?->category ?? ''));
  $isGrooming = str_contains($serviceCategory, 'groom');
  $isHotel = str_contains($serviceCategory, 'hotel');
  $isDaycare = str_contains($serviceCategory, 'day');
  $title = $isGrooming ? 'Pet Grooming Assessment Form' : 'Pet Assessment Form';
  $ownerName = trim(($owner->first_name ?? '') . ' ' . ($owner->last_name ?? '')) ?: ($owner->name ?? '');
  $species = $pet->speciesType->name ?? '';
  $normalizedSpecies = strtolower((string) $species);
  $isDog = str_contains($normalizedSpecies, 'dog') || str_contains($normalizedSpecies, 'canine');
  $isCat = str_contains($normalizedSpecies, 'cat') || str_contains($normalizedSpecies, 'feline');
  $breed = $pet->breed->name ?? '';
  $speciesBreed = trim($species . (($species && $breed) ? ' / ' : '') . $breed);
  $sex = strtolower((string) ($pet->sex ?? ''));
  $appointment = $form->appointment;
  $appointmentDate = $appointment?->appointment_date ? \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') : '';
  $appointmentTime = $appointment?->start_time ? \Carbon\Carbon::parse($appointment->start_time)->format('h:i A') : '';
  $checkoutDateTime = '';
  if ($appointment?->appointment_date && $appointment?->hotel_nights) {
    $checkoutDateTime = \Carbon\Carbon::parse($appointment->appointment_date)->addDays((int) $appointment->hotel_nights)->format('M d, Y');
  }
  $serviceName = $service?->name ?? $form->service_name ?? '';
  $vaccines = array_values(array_filter((array) ($form->vaccines ?? [])));
  $vaccineRecords = (array) ($form->vaccine_records ?? []);
  $medicalConditions = trim((string) ($form->medical_conditions ?? ''));
  $allergies = trim((string) ($form->allergies ?? ''));
  $isFriendlyValue = strtolower(trim((string) ($form->is_friendly ?? '')));
  $isFriendlyYes = in_array($isFriendlyValue, ['yes', 'socialize', 'friendly'], true);
  $isFriendlyNo = in_array($isFriendlyValue, ['no', 'alone', 'not friendly'], true);
  if (!count($vaccines)) {
    $vaccines = array_filter([
      ($form->vaccine_5in1 ?? false) ? '5-in-1 (DHPPiL)' : null,
      ($form->vaccine_rabies ?? false) ? 'Rabies' : null,
    ]);
  }
  $checked = function ($condition) { return $condition ? '✓' : ''; };
  $hasVaccine = function ($name) use ($vaccines, $form) {
    $needle = strtolower($name);
    foreach ($vaccines as $vaccine) {
      if (str_contains(strtolower((string) $vaccine), $needle)) return true;
    }
    if ($needle === 'rabies') return (bool) ($form->vaccine_rabies ?? false);
    if (str_contains($needle, '5-in-1')) return (bool) ($form->vaccine_5in1 ?? false);
    return false;
  };
  $conditionChecked = function ($field) use ($form, $checked) { return $checked((bool) ($form->{$field} ?? false)); };
  $logoPath = public_path('paw-realteal.png');
  $logoData = is_file($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : null;
@endphp

  <div class="document-header">
    @if($logoData)<img class="brand-mark" src="{{ $logoData }}" alt="The Fur Club">@endif
    <div class="title">{{ $title }}</div>
    <div class="station">The Fur Club Pet Station</div>
    <div class="contact">207 F. Blumentritt St. Kabayanan San Juan City, San Juan, Philippines, 1550</div>
    <div class="contact">0976 065 8031 | connect.thefurclub@gmail.com</div>
  </div>

  <div class="section">
    <div class="section-title">Owner | Pet Details</div>
    <table>
      <tr>
        <td class="half">
          <div class="bold">OWNER:</div>
          <table class="field">
            <tr><td class="label">Name:</td><td class="line breakable">{{ $ownerName }}</td></tr>
            <tr><td class="label">Contact No.:</td><td class="line">{{ $owner->phone ?? '' }}</td></tr>
            <tr><td class="label">Email:</td><td class="line breakable">{{ $owner->email ?? '' }}</td></tr>
            <tr><td class="label">Address:</td><td class="line breakable">{{ $owner->address ?? '' }}</td></tr>
          </table>
        </td>
        <td class="half">
          <div class="bold">PET:</div>
          <table class="field">
            <tr><td class="label">Pet Name:</td><td class="line">{{ $pet->name }}</td></tr>
            <tr><td class="label">Pet ID:</td><td class="line">{{ $pet->pet_id ?? $pet->display_id ?? '' }}</td></tr>
            <tr><td class="label">Species / Breed:</td><td class="line">{{ $speciesBreed }}</td></tr>
            <tr><td class="label">Date of Birth:</td><td class="line">{{ $pet->date_of_birth ? \Carbon\Carbon::parse($pet->date_of_birth)->format('M d, Y') : '' }}</td></tr>
            <tr>
              <td class="label">Age:</td>
              <td>
                <table><tr>
                  <td class="line" style="width:35%;">{{ $pet->date_of_birth ? \Carbon\Carbon::parse($pet->date_of_birth)->diffForHumans(null, true) : '' }}</td>
                  <td class="label" style="padding-left:10px;">Sex:</td>
                  <td><span class="check">{{ $checked(str_starts_with($sex, 'm')) }}</span>Male</td>
                  <td><span class="check">{{ $checked(str_starts_with($sex, 'f')) }}</span>Female</td>
                </tr></table>
              </td>
            </tr>
            @if($form->weight_kg !== null)
              <tr><td class="label">Weight:</td><td class="line">{{ number_format((float) $form->weight_kg, 2) }} kg</td></tr>
            @endif
          </table>
        </td>
      </tr>
    </table>
  </div>

  @if($form->created_at || $form->certified_at)
    <div class="section">
      <div class="section-title">Assessment Record</div>
      <table class="field">
        @if($form->created_at)
          <tr><td class="label">Submitted:</td><td class="line">{{ \Carbon\Carbon::parse($form->created_at)->format('M d, Y h:i A') }}</td></tr>
        @endif
        @if($form->certified_at)
          <tr><td class="label">Declaration recorded:</td><td class="line">{{ \Carbon\Carbon::parse($form->certified_at)->format('M d, Y h:i A') }}</td></tr>
        @endif
      </table>
    </div>
  @endif

@if($isGrooming)
  <div class="section">
    <div class="section-title">Pet Grooming Appointment Details</div>
    <table class="field"><tr>
      <td class="label">Date:</td><td class="line">{{ $appointmentDate }}</td>
      <td class="label" style="padding-left:28px;">Time:</td><td class="line">{{ $appointmentTime }}</td>
    </tr></table>
  </div>

  <div class="section">
    <div class="section-title">Grooming Services</div>
    <table class="grid">
      <tr><td><span class="check">{{ $checked(true) }}</span>{{ $serviceName ?: 'Grooming Package' }}</td><td></td></tr>
    </table>
    <table class="field"><tr><td class="label extras-label">Pawsome Extras:</td><td class="line">
      {{ collect($appointment?->appointmentAddons ?? [])->map(fn ($row) => $row->serviceAddon?->name)->filter()->implode(', ') }}
    </td></tr></table>
  </div>

  <div class="section">
    <div class="section-title">Physical Grooming Assessment</div>
    <table class="grid">
      <tr><td><span class="check">{{ $conditionChecked('has_ticks') }}</span>Ticks</td><td><span class="check">{{ $conditionChecked('has_flea') }}</span>Flea</td><td><span class="check">{{ $conditionChecked('has_wound') }}</span>Wound</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_mange') }}</span>Mange</td><td><span class="check">{{ $conditionChecked('has_bald_spot') }}</span>Bald Spot</td><td><span class="check">{{ $conditionChecked('has_skin_problem') }}</span>Skin Problem</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_lameness') }}</span>Lameness</td><td><span class="check">{{ $conditionChecked('has_eye_discharge') }}</span>Eye Discharge</td><td><span class="check">{{ $conditionChecked('has_nasal_discharge') }}</span>Nasal Discharge</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_ear_discharge') }}</span>Ear Discharge</td><td></td><td></td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Health & Behaviour</div>
    <table class="field">
      @if($medicalConditions !== '')
        <tr><td class="label">Medical Conditions:</td><td class="line" colspan="3">{{ $medicalConditions }}</td></tr>
      @endif
      @if($allergies !== '')
        <tr><td class="label">Allergies:</td><td class="line" colspan="3">{{ $allergies }}</td></tr>
      @endif
      @if($isFriendlyYes || $isFriendlyNo)
        <tr><td class="label">Can your pet safely socialize with other pets?:</td><td><span class="check">{{ $checked($isFriendlyYes) }}</span>Yes <span class="check">{{ $checked($isFriendlyNo) }}</span>No</td><td></td><td></td></tr>
      @endif
      @if(in_array($form->treat_preference ?? '', ['can_treats', 'no_treats'], true))
        <tr><td class="label">Can your pet have house treats?:</td><td><span class="check">{{ $checked($form->treat_preference === 'can_treats') }}</span>Yes <span class="check">{{ $checked($form->treat_preference === 'no_treats') }}</span>No</td></tr>
      @endif
      @if($form->is_vaccinated !== null)
        <tr><td class="label">Vaccinated:</td><td><span class="check">{{ $checked($form->is_vaccinated === 'Yes') }}</span>Yes <span class="check">{{ $checked($form->is_vaccinated === 'No') }}</span>No</td></tr>
      @endif
      @if($form->vet_clinic_name || $form->vet_contact_number)
        <tr><td class="label">Vet Clinic:</td><td class="line">{{ $form->vet_clinic_name }}</td><td class="label">Vet Contact Number:</td><td class="line">{{ $form->vet_contact_number }}</td></tr>
      @endif
    </table>
  </div>

  <div class="section">
    <div class="section-title">Grooming Reminders</div>
    <table class="two-policy">
      <tr>
        <td><div class="policy"><div class="policy-title">1. Flea & Tick-Free, Please!</div>Your pet should be free of fleas and ticks on the day of their appointment. If we spot any, we'll need to reschedule to protect all the other furry guests.</div></td>
        <td><div class="policy"><div class="policy-title">3. Behaviour & Handling</div>Please let us know if your pet is anxious, difficult to handle, or has shown aggression during grooming so we can provide the safest possible care.</div></td>
      </tr>
      <tr>
        <td><div class="policy"><div class="policy-title">2. Health & Skin Condition</div>Please inform us of any wounds, rashes, skin sensitivities, allergies, recent surgery, or medical conditions before grooming begins.</div></td>
        <td><div class="policy"><div class="policy-title">4. Matting & Coat Condition</div>Severely matted coats may require shaving or a shorter cut for your pet's comfort and safety. Additional charges may apply.</div></td>
      </tr>
    </table>
  </div>
@else
  <div class="section">
    <div class="section-title">Hotel & Daycare Service Details</div>
    <table class="grid">
      <tr>
        <td><span class="check">{{ $checked($isHotel) }}</span>Pet Hotel (Overnight Stay)</td>
        <td><span class="check">{{ $checked($isDaycare) }}</span>Pet Daycare (Play & Socialization)</td>
      </tr>
    </table>
    <table class="field"><tr>
      <td class="label">Check-in Date & Time:</td><td class="line">{{ trim($appointmentDate . ' ' . $appointmentTime) }}</td>
      <td class="label" style="padding-left:18px;">Check-out Date & Time:</td><td class="line">{{ $checkoutDateTime }}</td>
    </tr></table>
  </div>

  <div class="section">
    <div class="section-title">Veterinary Information</div>
    <table class="field">
      <tr><td class="label">Vaccinated:</td><td><span class="check">{{ $checked(($form->is_vaccinated ?? '') === 'Yes') }}</span>Yes <span class="check">{{ $checked(($form->is_vaccinated ?? '') === 'No') }}</span>No</td><td></td><td></td></tr>
      <tr><td class="label">Vet Clinic:</td><td class="line">{{ $form->vet_clinic_name ?? '' }}</td><td class="label">Vet Contact Number:</td><td class="line">{{ $form->vet_contact_number ?? '' }}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Vaccines</div>
    <table>
      <tr>
        <td class="half">
          <div class="bold">DOG VACCINES</div>
          <div class="bold small">Core / Common Combination Vaccines</div>
          @foreach(['Rabies','5-in-1 (DHPPiL)','6-in-1','7-in-1','8-in-1'] as $item)
            <div><span class="check">{{ $checked($isDog && $hasVaccine($item)) }}</span>{{ $item }}@if($item === 'Rabies' && $form->vaccine_date) <span class="small">({{ \Carbon\Carbon::parse($form->vaccine_date)->format('M d, Y') }})</span>@endif</div>
          @endforeach
          <div class="bold small" style="margin-top:3px;">Individual Canine Vaccines</div>
          @foreach(['Canine Distemper','Infectious Canine Hepatitis (Adenovirus)','Canine Parvovirus','Canine Parainfluenza','Leptospirosis','Bordetella (Kennel Cough)','Canine Influenza','Lyme Disease','Canine Coronavirus'] as $item)
            <div><span class="check">{{ $checked($isDog && $hasVaccine($item)) }}</span>{{ $item }}</div>
          @endforeach
        </td>
        <td class="half">
          <div class="bold">CAT VACCINES</div>
          <div class="bold small">Core / Common Combination Vaccines</div>
          @foreach(['Rabies','FVRCP (3-in-1 / 4-in-1)'] as $item)
            <div><span class="check">{{ $checked($isCat && $hasVaccine($item)) }}</span>{{ $item }}@if($item === 'Rabies' && $form->vaccine_date) <span class="small">({{ \Carbon\Carbon::parse($form->vaccine_date)->format('M d, Y') }})</span>@endif</div>
          @endforeach
          <div class="bold small" style="margin-top:3px;">Individual Feline Vaccines</div>
          @foreach(['Feline Viral Rhinotracheitis (FVR)','Feline Calicivirus (FCV)','Feline Panleukopenia (FPV)','Feline Leukemia Virus (FeLV)','Chlamydia felis','Bordetella bronchiseptica'] as $item)
            <div><span class="check">{{ $checked($isCat && $hasVaccine($item)) }}</span>{{ $item }}</div>
          @endforeach
        </td>
      </tr>
    </table>
    @if(count($vaccineRecords))
      <div class="small breakable"><span class="bold">Recorded vaccine dates:</span>
        {{ collect($vaccineRecords)->map(fn ($date, $name) => trim((string) $name) . ': ' . \Carbon\Carbon::parse($date)->format('M d, Y'))->implode(' | ') }}
      </div>
    @endif
  </div>

  <div class="section">
    <div class="section-title">Health, Medical Notes & Allergies</div>
    <table class="field">
      @if($medicalConditions !== '')
        <tr><td class="label">Medical Conditions:</td><td><span class="check">{{ $checked(strtolower($medicalConditions) !== 'none') }}</span>Yes <span class="check">{{ $checked(strtolower($medicalConditions) === 'none') }}</span>No</td><td class="label">Details:</td><td class="line">{{ $medicalConditions }}</td></tr>
      @endif
      @if($allergies !== '')
        <tr><td class="label">Allergies:</td><td><span class="check">{{ $checked(strtolower($allergies) !== 'none') }}</span>Yes <span class="check">{{ $checked(strtolower($allergies) === 'none') }}</span>No</td><td class="label">Details:</td><td class="line">{{ $allergies }}</td></tr>
      @endif
    </table>
  </div>

  <div class="section">
    <div class="section-title">Physical Assessment</div>
    <table class="grid">
      <tr><td><span class="check">{{ $conditionChecked('has_ticks') }}</span>Ticks</td><td><span class="check">{{ $conditionChecked('has_flea') }}</span>Flea</td><td><span class="check">{{ $conditionChecked('has_wound') }}</span>Wound</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_mange') }}</span>Mange</td><td><span class="check">{{ $conditionChecked('has_bald_spot') }}</span>Bald Spot</td><td><span class="check">{{ $conditionChecked('has_skin_problem') }}</span>Skin Problem</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_lameness') }}</span>Lameness</td><td><span class="check">{{ $conditionChecked('has_eye_discharge') }}</span>Eye Discharge</td><td><span class="check">{{ $conditionChecked('has_nasal_discharge') }}</span>Nasal Discharge</td></tr>
      <tr><td><span class="check">{{ $conditionChecked('has_ear_discharge') }}</span>Ear Discharge</td><td></td><td></td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Behaviour, Socialization & Treat Preferences</div>
    <table class="field">
      @if($isFriendlyYes || $isFriendlyNo)
        <tr><td class="label">Can your pet safely socialize with other pets?:</td><td><span class="check">{{ $checked($isFriendlyYes) }}</span>Yes <span class="check">{{ $checked($isFriendlyNo) }}</span>No</td></tr>
      @endif
      @if(in_array($form->treat_preference ?? '', ['can_treats', 'no_treats'], true))
        <tr><td class="label">Can your pet have house treats?:</td><td><span class="check">{{ $checked($form->treat_preference === 'can_treats') }}</span>Yes <span class="check">{{ $checked($form->treat_preference === 'no_treats') }}</span>No</td></tr>
      @endif
    </table>
  </div>

  <div class="section">
    <div class="section-title">Hotel & Daycare Policies</div>
    <table class="two-policy">
      <tr>
        <td><div class="policy"><div class="policy-title">1. Check-out & Pick-up Policy</div>Standard check-out time is _____ AM/PM. Pick-ups beyond the agreed time will incur a Daycare Fee ( _____ per hour).</div></td>
        <td><div class="policy"><div class="policy-title">3. Happy & Healthy Pets Only</div>Pets must have updated complete vaccinations with proof (vet card/record). Anti-tick & flea prevention is required before check-in. Pets with illness cannot be accepted.</div></td>
      </tr>
      <tr>
        <td><div class="policy"><div class="policy-title">2. Safety & Comfort</div>We provide a safe, clean, and loving environment. Pets showing extreme aggression may be refused or separated for safety.</div></td>
        <td><div class="policy"><div class="policy-title">4. Emergency Care</div>In case of emergency, we will contact you or your secondary contact. If urgent, your pet may be taken to your listed vet or the nearest clinic.</div></td>
      </tr>
    </table>
  </div>
@endif

  <div class="section">
    <div class="section-title">Acknowledgement & Declaration</div>
    <div>I, the undersigned Fur Parent, have read and agreed to The Fur Club's policies for the service availed. I authorize The Fur Club to provide the best possible care for my pet.</div>
    @if($form->declaration_accepted !== null)
      <div class="small"><span class="bold">Declaration accepted:</span> {{ $form->declaration_accepted ? 'Yes' : 'No' }}</div>
    @endif
  </div>
</body>
</html>
