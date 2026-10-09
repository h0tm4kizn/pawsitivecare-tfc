<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\HotelExtensionCharge;
use App\Models\Service;
use App\Models\ServiceTier;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class HotelExtensionService
{
    public function __construct(private readonly HotelClusterAllocator $hotelAllocator)
    {
    }

    public function preview(Appointment $appointment, Carbon $actualCheckout, ?string $confirmedSize = null): array
    {
        $appointment->loadMissing(['service', 'pet.speciesType']);
        if (strtolower((string) $appointment->service?->category) !== 'hotel') {
            throw ValidationException::withMessages(['appointment' => 'Extension charges apply only to Hotel Suite stays.']);
        }
        $scheduled = $appointment->scheduled_check_out_at?->copy()->timezone('Asia/Manila');
        if (!$scheduled) {
            throw ValidationException::withMessages(['appointment' => 'The scheduled Hotel Suite checkout is unavailable.']);
        }
        $actual = $actualCheckout->copy()->timezone('Asia/Manila');
        $extraSeconds = max(0, $actual->getTimestamp() - $scheduled->getTimestamp());
        $extraMinutes = (int) ceil($extraSeconds / 60);
        $hours = (int) ceil($extraSeconds / 3600);
        $species = $this->hotelAllocator->normalizeSpecies(
            $appointment->pet?->speciesType?->name ?? $appointment->pet?->speciesType?->code
        );
        $size = $this->hotelAllocator->normalizeConfirmedPetSize(
            $confirmedSize ?? $appointment->pet_size, $species
        );

        $result = [
            'pet_name' => $appointment->pet?->name,
            'pet_species' => $species,
            'pet_size' => $size,
            'scheduled_checkout_at' => $scheduled->toIso8601String(),
            'actual_checkout_at' => $actual->toIso8601String(),
            'extra_minutes' => $extraMinutes,
            'billable_hours' => $hours,
            'daycare_service_id' => null,
            'daycare_tier_id' => null,
            'daycare_tier_label' => null,
            'hourly_rate' => 0,
            'amount' => 0,
            'original_hotel_balance' => max(0, round((float) $appointment->total_price - (float) $appointment->deposit, 2)),
        ];
        if (!$species || !$size) {
            throw ValidationException::withMessages(['pet_size' => 'Confirm a valid Hotel pet size before checkout.']);
        }
        if ($hours === 0) {
            $result['total_amount_due'] = $result['original_hotel_balance'];
            return $result;
        }
        $tierSize = $species === 'cat' ? 'Small' : $size;
        $label = 'Hourly - ' . $tierSize;
        $services = Service::query()->where('category', 'daycare')->where('is_active', true)->get();
        if ($services->count() !== 1) {
            throw ValidationException::withMessages(['daycare_rate' => 'A unique active Daycare service is required for Hotel extension pricing.']);
        }
        $service = $services->first();
        $tiers = ServiceTier::query()->where('service_id', $service->id)
            ->whereRaw('LOWER(size_label) = ?', [strtolower($label)])
            ->where('duration_hours', 1)->get();
        if ($tiers->count() !== 1 || $tiers->first()->price === null || (float) $tiers->first()->price <= 0 || $tiers->first()->price_max !== null) {
            throw ValidationException::withMessages(['daycare_rate' => "A unique fixed one-hour Daycare rate for {$size} is unavailable."]);
        }
        $tier = $tiers->first();
        $result['daycare_service_id'] = $service->id;
        $result['daycare_tier_id'] = $tier->id;
        $result['daycare_tier_label'] = $tier->size_label;
        $result['hourly_rate'] = (float) $tier->price;
        $result['amount'] = round($hours * (float) $tier->price, 2);
        $result['total_amount_due'] = round($result['original_hotel_balance'] + $result['amount'], 2);
        return $result;
    }

    public function record(Appointment $appointment, array $preview, array $payment, ?string $handledBy, ?string $recordedBy): ?HotelExtensionCharge
    {
        if ($preview['amount'] <= 0) return null;
        if (HotelExtensionCharge::query()->where('appointment_id', $appointment->id)->exists()) {
            throw ValidationException::withMessages(['appointment' => 'An extension charge is already recorded for this appointment.']);
        }
        if (($payment['extension_payment_confirmed'] ?? false) !== true) {
            throw ValidationException::withMessages(['extension_payment_confirmed' => 'Confirm that the extension payment was received.']);
        }
        $method = $payment['extension_payment_method'] ?? null;
        if (!in_array($method, ['cash', 'e_wallet', 'bank_transfer'], true)) {
            throw ValidationException::withMessages(['extension_payment_method' => 'Select the extension payment method.']);
        }
        $paid = round((float) ($payment['extension_payment_amount'] ?? 0), 2);
        if ($paid !== round((float) $preview['amount'], 2)) {
            throw ValidationException::withMessages(['extension_payment_amount' => 'The recorded extension payment must equal the extension charge.']);
        }
        $reference = trim((string) ($payment['extension_payment_reference'] ?? ''));
        if ($method !== 'cash' && $reference === '') {
            throw ValidationException::withMessages(['extension_payment_reference' => 'A payment reference is required for electronic extension payments.']);
        }
        return HotelExtensionCharge::create([
            'appointment_id' => $appointment->id,
            'pet_species' => $preview['pet_species'],
            'pet_size' => $preview['pet_size'],
            'daycare_service_id' => $preview['daycare_service_id'],
            'daycare_tier_id' => $preview['daycare_tier_id'],
            'daycare_tier_label' => $preview['daycare_tier_label'],
            'hourly_rate' => $preview['hourly_rate'],
            'scheduled_checkout_at' => $preview['scheduled_checkout_at'],
            'actual_checkout_at' => $preview['actual_checkout_at'],
            'extra_minutes' => $preview['extra_minutes'],
            'billable_hours' => $preview['billable_hours'],
            'amount' => $preview['amount'],
            'payment_amount' => $paid,
            'payment_method' => $method,
            'payment_status' => 'paid',
            'payment_reference' => $reference ?: null,
            'handled_by' => $handledBy,
            'recorded_by' => $recordedBy,
            'recorded_at' => now('Asia/Manila'),
        ]);
    }
}
