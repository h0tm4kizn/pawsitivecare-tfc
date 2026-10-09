<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionSetting extends Model
{
    use HasUuids;

    protected $fillable = ['staff_id', 'service_category', 'rate_percent', 'calculation_basis', 'is_active', 'effective_from', 'created_by'];

    protected $casts = ['rate_percent' => 'float', 'is_active' => 'boolean', 'effective_from' => 'date'];

    public function staff(): BelongsTo { return $this->belongsTo(User::class, 'staff_id'); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
