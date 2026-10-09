<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffCommission extends Model
{
    use HasUuids;

    protected $fillable = ['staff_id', 'appointment_id', 'service_id', 'service_amount', 'commission_base_amount', 'rate_percent', 'commission_amount', 'calculation_basis', 'earned_at'];

    protected $casts = ['service_amount' => 'float', 'commission_base_amount' => 'float', 'rate_percent' => 'float', 'commission_amount' => 'float', 'earned_at' => 'datetime'];

    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
    public function appointment(): BelongsTo { return $this->belongsTo(Appointment::class); }
    public function service(): BelongsTo { return $this->belongsTo(Service::class); }
}
