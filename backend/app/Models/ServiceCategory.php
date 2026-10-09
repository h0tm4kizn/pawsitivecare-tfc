<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ServiceCategory extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'color', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
