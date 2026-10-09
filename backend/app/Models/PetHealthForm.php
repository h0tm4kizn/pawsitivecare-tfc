<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PetHealthForm extends Model
{
    use HasUuids;

    protected $table = 'pet_assessment_form';

    protected $fillable = [
        'pet_id',
        'owner_id',
        'service_id',
        'appointment_id',
        'is_vaccinated',
        'vaccine_date',
        'vaccines',
        'vaccine_records',
        'vaccine_5in1',
        'vaccine_rabies',
        'vet_clinic_name',
        'vet_contact_number',
        'is_friendly',
        'treat_preference',
        'allergies',
        'has_ticks',
        'has_flea',
        'has_wound',
        'has_mange',
        'has_bald_spot',
        'has_skin_problem',
        'has_lameness',
        'has_eye_discharge',
        'has_nasal_discharge',
        'has_ear_discharge',
        'medical_conditions',
        'declaration_accepted',
        'certified_at',
        'weight_kg',
    ];

    protected $casts = [
        'vaccine_5in1'         => 'boolean',
        'vaccine_rabies'       => 'boolean',
        'vaccine_date'         => 'date',
        'vaccines'             => 'array',
        'vaccine_records'      => 'array',
        'weight_kg'            => 'decimal:2',
        'has_ticks'            => 'boolean',
        'has_flea'             => 'boolean',
        'has_wound'            => 'boolean',
        'has_mange'            => 'boolean',
        'has_bald_spot'        => 'boolean',
        'has_skin_problem'     => 'boolean',
        'has_lameness'         => 'boolean',
        'has_eye_discharge'    => 'boolean',
        'has_nasal_discharge'  => 'boolean',
        'has_ear_discharge'    => 'boolean',
        'declaration_accepted' => 'boolean',
        'certified_at'         => 'datetime',
    ];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class, 'pet_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class, 'owner_id');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }
}