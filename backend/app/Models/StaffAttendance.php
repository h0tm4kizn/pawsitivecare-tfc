<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAttendance extends Model
{
    use HasUuids;

    protected $table = 'staff_attendance';

    protected $fillable = ['staff_id', 'time_in_at', 'time_out_at', 'timezone', 'recorded_by', 'recording_method'];

    protected $casts = ['time_in_at' => 'datetime', 'time_out_at' => 'datetime'];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
