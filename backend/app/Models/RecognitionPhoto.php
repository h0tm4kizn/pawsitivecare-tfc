<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecognitionPhoto extends Model
{
    use HasUuids;

    protected $fillable = ['pet_id', 'photo_url', 'image_hash', 'captured_at'];

    protected $casts = ['captured_at' => 'datetime'];

    public function pet(): BelongsTo
    {
        return $this->belongsTo(Pet::class);
    }
}
