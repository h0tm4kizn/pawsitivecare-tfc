<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\HotelSuite;
use App\Models\Promotion;
use App\Models\Service;
use App\Models\ServiceAddon;
use App\Models\ServiceTier;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class AppointmentPricingService
{
    public function recalculate(Appointment $appointment): void
    {
        $appointment->loadMissing(['service', 'hotelSuite']);

        $basePrice = $this->resolveBasePriceFromServicePackage($appointment);
        $addonTotal = (float) $appointment->appointmentAddons()->sum('price_charged');

        $isGrooming = strtolower((string) ($appointment->service?->category ?? '')) === 'grooming';
        $groomingDiscount = null;

        if ($isGrooming && $appointment->pet_id && $appointment->appointment_date) {
            $hasDaycareSameDay = Appointment::query()
                ->where('pet_id', $appointment->pet_id)
                ->whereDate('appointment_date', $appointment->appointment_date)
                ->where('id', '!=', $appointment->id)
                ->whereHas('service', fn ($q) => $q->where('category', 'daycare'))
                ->exists();

            if ($hasDaycareSameDay) {
                $groomingDiscount = round($basePrice * 0.1, 2);
            }
        }

        $total = max(0, $basePrice + $addonTotal - ($groomingDiscount ?? 0));

        $appointment->update([
            'total_price' => $total,
            'grooming_discount' => $groomingDiscount,
            'is_full_day_package' => $groomingDiscount !== null,
        ]);
    }

    public function addonAppliesToService(ServiceAddon $addon, ?Service $service): bool
    {
        if (!$service) {
            return false;
        }

        $serviceCategory = strtolower((string) $service->category);
        $addonCategory = strtolower((string) ($addon->category ?? ''));

        if ($serviceCategory === 'grooming') {
            return (bool) ($addon->applies_to_grooming ?? false)
                || in_array($addonCategory, ['grooming_extra', 'grooming_addon', 'treatment'], true);
        }

        if ($serviceCategory === 'daycare') {
            return (bool) ($addon->applies_to_daycare ?? false)
                || $addonCategory === 'daycare_upgrade';
        }

        if ($serviceCategory === 'hotel') {
            return (bool) ($addon->applies_to_hotel ?? false)
                || in_array($addonCategory, ['hotel_grooming', 'hotel_addon'], true);
        }

        return false;
    }

    public function resolveBasePriceFromServicePackage(Appointment $appointment): float
    {
        $category = strtolower((string) ($appointment->service?->category ?? ''));

        if ($category === 'hotel') {
            $nightlyRate = (float) ($appointment->hotelSuite?->price_per_night ?? 0);
            $nights = max(1, (int) ($appointment->hotel_nights ?? 1));

            return $this->applyStoredPromotion($appointment, $nightlyRate * $nights);
        }

        if (!$appointment->service_id || !$appointment->size_label) {
            return 0.0;
        }

        $tier = ServiceTier::query()
            ->where('service_id', $appointment->service_id)
            ->where('size_label', $appointment->size_label)
            ->first();

        return $this->applyStoredPromotion($appointment, (float) ($tier?->price ?? 0));
    }

    public function rawAppointmentBasePrice(
        ?Service $service,
        ?string $hotelSuiteId,
        ?int $hotelNights,
        ?string $sizeLabel
    ): float {
        if (!$service) {
            return 0.0;
        }

        if (strtolower((string) $service->category) === 'hotel') {
            $suite = $hotelSuiteId ? HotelSuite::find($hotelSuiteId) : null;

            return (float) ($suite?->price_per_night ?? 0) * max(1, (int) ($hotelNights ?? 1));
        }

        return (float) ServiceTier::query()
            ->where('service_id', $service->id)
            ->where('size_label', $sizeLabel)
            ->value('price');
    }

    public function resolveAppointmentPromotion(
        ?string $promotionId,
        ?Service $service,
        ?string $sizeLabel,
        $date,
        float $basePrice
    ): ?Promotion {
        if (!$promotionId) {
            return null;
        }

        $promotion = Promotion::query()
            ->availableOn(Carbon::parse($date, 'Asia/Manila')->toDateString())
            ->find($promotionId);

        if (!$promotion || !$service) {
            throw ValidationException::withMessages([
                'promotion_id' => 'The selected promotion is inactive, expired, or unavailable.',
            ]);
        }

        $eligible = $promotion->applies_to_all_services;
        if (!$eligible) {
            $tierQuery = $promotion->serviceTiers()->where('service_id', $service->id);
            if (strtolower((string) $service->category) !== 'hotel') {
                $tierQuery->where('size_label', $sizeLabel);
            }
            $eligible = $tierQuery->exists();
        }

        if (!$eligible) {
            throw ValidationException::withMessages([
                'promotion_id' => 'The selected promotion is not eligible for this service package.',
            ]);
        }

        return $promotion;
    }

    private function applyStoredPromotion(Appointment $appointment, float $basePrice): float
    {
        if (!$appointment->promotion_id || $basePrice <= 0) {
            return $basePrice;
        }

        if ($appointment->promotion_title_snapshot !== null && $appointment->promotion_final_price !== null) {
            return (float) $appointment->promotion_final_price;
        }

        $promotion = Promotion::find($appointment->promotion_id);
        if (!$promotion) {
            return $basePrice;
        }

        $discounted = round($promotion->priceFor($basePrice), 2);
        if (!$appointment->promotion_title_snapshot) {
            $appointment->forceFill([
                'promotion_title_snapshot' => $promotion->title,
                'promotion_type_snapshot' => $promotion->discount_type,
                'promotion_value_snapshot' => $promotion->discount_type === 'promotional_price'
                    ? $promotion->promotional_price
                    : $promotion->discount_value,
                'promotion_original_price' => round($basePrice, 2),
                'promotion_discount_amount' => round($basePrice - $discounted, 2),
                'promotion_final_price' => $discounted,
            ])->saveQuietly();
        }

        return $discounted;
    }
}
