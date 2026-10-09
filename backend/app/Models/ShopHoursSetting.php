<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShopHoursSetting extends Model
{
    protected $table = 'shop_hours';
    protected $primaryKey = 'key';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = ['key', 'value', 'updated_at'];

    protected $casts = [
        'value' => 'array',
        'updated_at' => 'datetime',
    ];

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::find($key);
        return $row ? $row->value : $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'updated_at' => now('Asia/Manila')]
        );
    }
}

