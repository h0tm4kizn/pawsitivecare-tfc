<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopHoursSetting;
use App\Models\Service;
use Illuminate\Http\Request;

class ShopHoursController extends Controller
{
    /**
     * GET /api/clinic/schedule
     * Public — returns all schedule settings + blocked dates.
     */
    public function index()
    {
        $hotelAvailable = \App\Models\HotelSuite::where('is_available', true)->count();
        $hotelTotal     = \App\Models\HotelSuite::count();

        // Seed shop_hours_raw from ShopHour table if not yet set.
        // This ensures availableSlots always has clean 24h data without manual re-save.
        if (empty(ShopHoursSetting::get('shop_hours_raw', []))) {
            ShopHoursSetting::set('shop_hours_raw', self::buildShopHoursRaw());
        }

        return response()->json([
            'data' => [
                'grooming'        => ShopHoursSetting::get('schedule.grooming'),
                'hotel'           => ShopHoursSetting::get('schedule.hotel'),
                'daycare'         => ShopHoursSetting::get('schedule.daycare'),
                'blocked_dates'   => ShopHoursSetting::get('blocked_dates', []),
                'cages'           => ShopHoursSetting::get('cages', []),
                'shop_hours'      => self::buildShopHours(),
                'hotel_available' => $hotelAvailable,
                'hotel_total'     => $hotelTotal,
            ],
        ]);
    }

    /**
     * Build shop_hours array from ShopHoursSetting.
     * The shop_hours table is no longer used—all data comes from shop_hours JSON.
     */
    private static function buildShopHours(): array
    {
        $shortKeys = ['mon','tue','wed','thu','fri','sat','sun'];
        $saved     = ShopHoursSetting::get('shop_hours', []);
        $result    = [];

        foreach ($shortKeys as $short) {
            $result[$short] = $saved[$short] ?? 'Closed';
        }

        return $result;
    }

    /**
     * Build raw 24h shop_hours_raw array from ShopHoursSetting.
     * Parses formatted display strings (e.g., "8:00 AM - 9:00 PM") into structured time data.
     * No longer uses ShopHour table—all data comes from shop_hours JSON.
     */
    private static function buildShopHoursRaw(): array
    {
        $shortKeys = ['mon','tue','wed','thu','fri','sat','sun'];
        $formatted = ShopHoursSetting::get('shop_hours', []);
        $result    = [];

        foreach ($shortKeys as $short) {
            $str = $formatted[$short] ?? null;

            if ($str !== null) {
                // Parse from user-saved formatted string (e.g., "8:00 AM - 9:00 PM")
                if (strtolower(trim($str)) === 'closed') {
                    $result[$short] = ['closed' => true];
                } elseif (preg_match('/(\d{1,2}:\d{2})\s*(AM|PM)\s*[–\-]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i', $str, $m)) {
                    $result[$short] = [
                        'closed' => false,
                        'open'   => date('H:i', strtotime("{$m[1]} {$m[2]}")),
                        'close'  => date('H:i', strtotime("{$m[3]} {$m[4]}")),
                    ];
                } else {
                    // Couldn't parse—mark as closed
                    $result[$short] = ['closed' => true];
                }
            } else {
                // No data for this day—default to closed
                $result[$short] = ['closed' => true];
            }
        }

        return $result;
    }

    /**
     * PUT /api/admin/clinic/schedule/{category}
     * Admin only — update schedule for grooming, hotel, or daycare.
     */
    public function updateSchedule(Request $request, string $category)
    {
        if (!in_array($category, ['grooming', 'hotel', 'daycare'])) {
            return response()->json(['message' => 'Invalid category.'], 422);
        }

        $rules = $category === 'hotel'
            ? [
                'days'       => 'required|array',
                'days.*'     => 'integer|between:0,6',
                'check_in'   => 'required|date_format:H:i',
                'check_out'  => 'required|date_format:H:i',
                'max_nights' => 'required|integer|min:1|max:30',
            ]
            : [
                'days'          => 'required|array',
                'days.*'        => 'integer|between:0,6',
                'open'          => 'required|date_format:H:i',
                'close'         => 'required|date_format:H:i',
                'interval_mins' => 'required|integer|in:30,60,90,120',
                'max_slots'     => 'required|integer|min:1|max:10',
            ];

        $validated = $request->validate($rules);

        ShopHoursSetting::set("schedule.{$category}", $validated);

        return response()->json([
            'message' => ucfirst($category) . ' schedule updated.',
            'data'    => $validated,
        ]);
    }

    /**
     * PUT /api/admin/clinic/shop-hours
     * Admin only — update shop hours per day.
     */
    public function updateShopHours(Request $request)
    {
        $request->validate([
            'mon' => 'nullable|string|max:50',
            'tue' => 'nullable|string|max:50',
            'wed' => 'nullable|string|max:50',
            'thu' => 'nullable|string|max:50',
            'fri' => 'nullable|string|max:50',
            'sat' => 'nullable|string|max:50',
            'sun' => 'nullable|string|max:50',
        ]);

        ShopHoursSetting::set('shop_hours', $request->only(['mon','tue','wed','thu','fri','sat','sun']));

        // Store raw 24h times for slot generation (avoids ShopHour table dependency).
        $rawTimes = $request->input('_raw', []);
        if (!empty($rawTimes)) {
            ShopHoursSetting::set('shop_hours_raw', $rawTimes);
        }

        // Note: ShopHour table sync removed — all shop hours now stored in ShopHoursSetting JSON only.

        return response()->json([
            'message' => 'Shop hours updated.',
            'data'    => ShopHoursSetting::get('shop_hours'),
        ]);
    }

    /**
     * PUT /api/admin/clinic/blocked-dates
     * Admin only — replace the blocked dates list.
     */
    public function updateBlockedDates(Request $request)
    {
        $request->validate([
            'dates'          => 'present|array',
            'dates.*'        => 'date_format:Y-m-d',
        ]);

        ShopHoursSetting::set('blocked_dates', $request->dates);

        return response()->json([
            'message' => 'Blocked dates updated.',
            'data'    => $request->dates,
        ]);
    }

    /**
     * PUT /api/admin/clinic/cages
     * Admin only — update hotel cluster capacities.
     *
     * Accepted payload:
     * {
     *   "clusters": { "A": 6, "B": 6, "C": 3, "D": 3 }
     * }
     * or direct keys:
     * { "A": 6, "B": 6, "C": 3, "D": 3 }
     */
    public function updateCages(Request $request)
    {
        $request->validate([
            'clusters' => 'nullable|array',
            'A' => 'nullable|integer|min:0|max:200',
            'B' => 'nullable|integer|min:0|max:200',
            'C' => 'nullable|integer|min:0|max:200',
            'D' => 'nullable|integer|min:0|max:200',
        ]);

        $incoming = $request->input('clusters', []);
        if (!is_array($incoming) || empty($incoming)) {
            $incoming = $request->only(['A', 'B', 'C', 'D']);
        }

        $current = ShopHoursSetting::get('cages', [
            'A' => 6,
            'B' => 6,
            'C' => 3,
            'D' => 3,
        ]);

        $normalized = [
            'A' => (int)($incoming['A'] ?? $current['A'] ?? 6),
            'B' => (int)($incoming['B'] ?? $current['B'] ?? 6),
            'C' => (int)($incoming['C'] ?? $current['C'] ?? 3),
            'D' => (int)($incoming['D'] ?? $current['D'] ?? 3),
        ];

        ShopHoursSetting::set('cages', $normalized);

        return response()->json([
            'message' => 'Hotel cluster capacities updated.',
            'data' => $normalized,
        ]);
    }

}
