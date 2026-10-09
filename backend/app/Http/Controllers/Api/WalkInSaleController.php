<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryBatch;
use App\Models\Supply;
use App\Models\SupplyItem;
use App\Models\WalkInSale;
use App\Models\WalkInSaleItem;
use App\Models\Promotion;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WalkInSaleController extends Controller
{
    public function index(Request $request)
    {
        $query = WalkInSale::with(['items', 'supply.supplyItems.batch', 'soldBy:id,name'])
            ->whereNull('voided_at')
            ->orderByDesc('sold_at');

        if ($request->filled('start_date')) {
            $query->whereDate('sold_at', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('sold_at', '<=', $request->end_date);
        }

        $perPage = min((int) $request->query('per_page', 20), 100);

        $sales = $query->paginate($perPage);
        $sales->getCollection()->transform(fn (WalkInSale $sale) => $this->serializeSupplySale($sale));

        return $this->success(
            $sales,
            'Walk-in sales retrieved successfully.'
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'appointment_id'         => 'nullable|uuid|exists:appointments,id',
            'customer_name'          => 'nullable|string|max:150',
            'payment_method'         => 'nullable|in:cash,ewallet,bank',
            'payment_channel'        => 'nullable|string|max:60',
            'payment_received_by'    => 'nullable|in:cash_register,gcash,bpi,bdo,maya',
            'reference_number'       => 'nullable|string|max:100',
            'notes'                  => 'nullable|string|max:1000',
            'items'                  => 'required|array|min:1',
            'items.*.inventory_id'   => 'required|uuid|exists:inventory,id',
            'items.*.batch_id'       => 'nullable|uuid|exists:inventory_batches,id',
            'items.*.quantity'       => 'required|integer|min:1',
            'items.*.promotion_id'   => 'nullable|uuid|exists:promotions,id',
        ]);

        return DB::transaction(function () use ($validated) {
            $lines = [];
            $total = 0;

            foreach ($validated['items'] as $line) {
                $inv = Inventory::query()->whereKey($line['inventory_id'])->lockForUpdate()->firstOrFail();
                $requestedQuantity = (int) $line['quantity'];
                $batchDeductions = $this->resolveBatchDeductions($inv, $requestedQuantity, $line['batch_id'] ?? null);

                $deductibleQuantity = array_sum(array_column($batchDeductions, 'quantity'));
                if ($deductibleQuantity < $requestedQuantity) {
                    $available = $inv->batches()->sum('quantity_available');
                    throw ValidationException::withMessages([
                        'items' => "Insufficient stock for \"{$inv->item_name}\". Available: {$available}.",
                    ]);
                }

                $subtotal = $inv->selling_price * $requestedQuantity;
                $promotion = $this->resolveRetailPromotion($line['promotion_id'] ?? null, $inv);
                $unitPrice = $promotion ? round($promotion->priceFor((float) $inv->selling_price), 2) : (float) $inv->selling_price;
                $subtotal = round($unitPrice * $requestedQuantity, 2);
                $total   += $subtotal;
                $lines[]  = [
                    'inventory'           => $inv,
                    'quantity'            => $requestedQuantity,
                    'batch_deductions'    => $batchDeductions,
                    'cost_price_snapshot' => $inv->cost_price,
                    'selling_price'       => $unitPrice,
                    'subtotal'            => $subtotal,
                    'promotion'           => $promotion,
                    'original_unit_price' => (float) $inv->selling_price,
                    'discount_amount'    => round(((float) $inv->selling_price - $unitPrice) * $requestedQuantity, 2),
                ];
            }

            $sale = WalkInSale::create([
                'receipt_number'   => $this->nextReceiptNumber(),
                'appointment_id'   => $validated['appointment_id'] ?? null,
                'customer_name'    => $validated['customer_name'] ?? null,
                'total_amount'     => $total,
                'payment_method'   => $validated['payment_method'] ?? null,
                'payment_channel'  => $validated['payment_channel'] ?? null,
                'payment_received_by' => $validated['payment_received_by'] ?? null,
                'reference_number' => $validated['reference_number'] ?? null,
                'notes'            => $validated['notes'] ?? null,
                'sold_by'          => Auth::id(),
                'sold_at'          => now('Asia/Manila'),
            ]);

            $supply = Supply::create([
                'walk_in_sale_id' => $sale->id,
                'appointment_id' => $validated['appointment_id'] ?? null,
                'total_amount' => $total,
                'created_by' => Auth::id(),
            ]);

            foreach ($lines as $line) {
                WalkInSaleItem::create([
                    'walk_in_sale_id'    => $sale->id,
                    'inventory_id'       => $line['inventory']->id,
                    'item_snapshot_id'   => $line['inventory']->item_id,
                    'item_snapshot_name' => $line['inventory']->item_name,
                    'cost_price_snapshot' => $line['cost_price_snapshot'],
                    'quantity'           => $line['quantity'],
                    'selling_price'      => $line['selling_price'],
                    'subtotal'           => $line['subtotal'],
                    'promotion_id'      => $line['promotion']?->id,
                    'promotion_title_snapshot' => $line['promotion']?->title,
                    'promotion_type_snapshot' => $line['promotion']?->discount_type,
                    'promotion_value_snapshot' => $line['promotion']
                        ? ($line['promotion']->discount_type === 'promotional_price' ? $line['promotion']->promotional_price : $line['promotion']->discount_value)
                        : null,
                    'original_unit_price' => $line['original_unit_price'],
                    'discount_amount' => $line['discount_amount'],
                    'final_unit_price' => $line['selling_price'],
                ]);

                foreach ($line['batch_deductions'] as $deduction) {
                    $batch = $deduction['batch'];
                    $quantityUsed = (int) $deduction['quantity'];
                    $batch->update([
                        'quantity_available' => max(0, (int) $batch->quantity_available - $quantityUsed),
                    ]);

                    SupplyItem::create([
                        'supply_id' => $supply->id,
                        'product_id' => $line['inventory']->id,
                        'batch_id' => $batch->id,
                        'product_name' => $line['inventory']->item_name,
                        'quantity_used' => $quantityUsed,
                        'unit_price' => $line['selling_price'],
                        'line_total' => $line['selling_price'] * $quantityUsed,
                        'expiration_date' => $batch->expiration_date,
                        'batch_quantity_used' => $quantityUsed,
                    ]);
                }

                $this->syncProductStockFromBatches($line['inventory']);
            }

            return $this->success(
                $this->serializeSupplySale($sale->load(['items', 'supply.supplyItems.batch', 'soldBy:id,name'])),
                'Walk-in sale recorded successfully.',
                201
            );
        });
    }

    public function show(WalkInSale $walkInSale)
    {
        return $this->success(
            $this->serializeSupplySale($walkInSale->load(['items', 'supply.supplyItems.batch', 'soldBy:id,name'])),
            'Walk-in sale retrieved successfully.'
        );
    }

    public function update(Request $request, WalkInSale $walkInSale)
    {
        if ($walkInSale->voided_at) {
            return $this->error('Voided sales cannot be edited.', 422);
        }

        $validated = $request->validate([
            'customer_name'          => 'nullable|string|max:150',
            'payment_method'         => 'nullable|in:cash,ewallet,bank',
            'payment_channel'        => 'nullable|string|max:60',
            'payment_received_by'    => 'nullable|in:cash_register,gcash,bpi,bdo,maya',
            'reference_number'       => 'nullable|string|max:100',
            'notes'                  => 'nullable|string|max:1000',
            'items'                  => 'required|array|min:1',
            'items.*.inventory_id'   => 'required|uuid|exists:inventory,id',
            'items.*.batch_id'       => 'nullable|uuid|exists:inventory_batches,id',
            'items.*.quantity'       => 'required|integer|min:1',
            'items.*.promotion_id'   => 'nullable|uuid|exists:promotions,id',
        ]);

        return DB::transaction(function () use ($validated, $walkInSale) {
            $walkInSale->load(['items', 'supply.supplyItems.batch.product']);
            $this->restoreSaleInventory($walkInSale);

            $lines = [];
            $total = 0;
            foreach ($validated['items'] as $line) {
                $inv = Inventory::query()->whereKey($line['inventory_id'])->lockForUpdate()->firstOrFail();
                $requestedQuantity = (int) $line['quantity'];
                $batchDeductions = $this->resolveBatchDeductions($inv, $requestedQuantity, $line['batch_id'] ?? null);

                $deductibleQuantity = array_sum(array_column($batchDeductions, 'quantity'));
                if ($deductibleQuantity < $requestedQuantity) {
                    $available = $inv->batches()->sum('quantity_available');
                    throw ValidationException::withMessages([
                        'items' => "Insufficient stock for \"{$inv->item_name}\". Available: {$available}.",
                    ]);
                }

                $subtotal = $inv->selling_price * $requestedQuantity;
                $promotion = $this->resolveRetailPromotion($line['promotion_id'] ?? null, $inv);
                $unitPrice = $promotion ? round($promotion->priceFor((float) $inv->selling_price), 2) : (float) $inv->selling_price;
                $subtotal = round($unitPrice * $requestedQuantity, 2);
                $total += $subtotal;
                $lines[] = [
                    'inventory' => $inv,
                    'quantity' => $requestedQuantity,
                    'batch_deductions' => $batchDeductions,
                    'cost_price_snapshot' => $inv->cost_price,
                    'selling_price' => $unitPrice,
                    'subtotal' => $subtotal,
                    'promotion' => $promotion,
                    'original_unit_price' => (float) $inv->selling_price,
                    'discount_amount' => round(((float) $inv->selling_price - $unitPrice) * $requestedQuantity, 2),
                ];
            }

            $walkInSale->items()->delete();
            $supply = $walkInSale->supply ?: Supply::create([
                'walk_in_sale_id' => $walkInSale->id,
                'appointment_id' => $walkInSale->appointment_id,
                'total_amount' => 0,
                'created_by' => $walkInSale->sold_by ?: Auth::id(),
            ]);
            $supply->supplyItems()->delete();

            $walkInSale->update([
                'customer_name'    => $validated['customer_name'] ?? null,
                'total_amount'     => $total,
                'payment_method'   => $validated['payment_method'] ?? null,
                'payment_channel'  => $validated['payment_channel'] ?? null,
                'payment_received_by' => $validated['payment_received_by'] ?? null,
                'reference_number' => $validated['reference_number'] ?? null,
                'notes'            => $validated['notes'] ?? null,
            ]);
            $supply->update(['total_amount' => $total]);

            foreach ($lines as $line) {
                WalkInSaleItem::create([
                    'walk_in_sale_id'     => $walkInSale->id,
                    'inventory_id'        => $line['inventory']->id,
                    'item_snapshot_id'    => $line['inventory']->item_id,
                    'item_snapshot_name'  => $line['inventory']->item_name,
                    'cost_price_snapshot' => $line['cost_price_snapshot'],
                    'quantity'            => $line['quantity'],
                    'selling_price'       => $line['selling_price'],
                    'subtotal'            => $line['subtotal'],
                    'promotion_id'      => $line['promotion']?->id,
                    'promotion_title_snapshot' => $line['promotion']?->title,
                    'promotion_type_snapshot' => $line['promotion']?->discount_type,
                    'promotion_value_snapshot' => $line['promotion']
                        ? ($line['promotion']->discount_type === 'promotional_price' ? $line['promotion']->promotional_price : $line['promotion']->discount_value)
                        : null,
                    'original_unit_price' => $line['original_unit_price'],
                    'discount_amount' => $line['discount_amount'],
                    'final_unit_price' => $line['selling_price'],
                ]);

                foreach ($line['batch_deductions'] as $deduction) {
                    $batch = $deduction['batch'];
                    $quantityUsed = (int) $deduction['quantity'];
                    $batch->update([
                        'quantity_available' => max(0, (int) $batch->quantity_available - $quantityUsed),
                    ]);

                    SupplyItem::create([
                        'supply_id' => $supply->id,
                        'product_id' => $line['inventory']->id,
                        'batch_id' => $batch->id,
                        'product_name' => $line['inventory']->item_name,
                        'quantity_used' => $quantityUsed,
                        'unit_price' => $line['selling_price'],
                        'line_total' => $line['selling_price'] * $quantityUsed,
                        'expiration_date' => $batch->expiration_date,
                        'batch_quantity_used' => $quantityUsed,
                    ]);
                }

                $this->syncProductStockFromBatches($line['inventory']);
            }

            return $this->success(
                $this->serializeSupplySale($walkInSale->fresh()->load(['items', 'supply.supplyItems.batch', 'soldBy:id,name'])),
                'Walk-in sale updated successfully.'
            );
        });
    }

    public function void(WalkInSale $walkInSale)
    {
        if ($walkInSale->voided_at) {
            return $this->error('This sale has already been voided.', 422);
        }

        return DB::transaction(function () use ($walkInSale) {
            $walkInSale->load(['items.inventory', 'supply.supplyItems.batch.product']);
            $this->restoreSaleInventory($walkInSale);

            $walkInSale->update([
                'voided_at' => Carbon::now('Asia/Manila'),
                'voided_by' => Auth::id(),
            ]);

            return $this->success($walkInSale, 'Sale voided and inventory restored.');
        });
    }

    private function restoreSaleInventory(WalkInSale $walkInSale): void
    {
        if ($walkInSale->supply) {
            foreach ($walkInSale->supply->supplyItems as $supplyItem) {
                $batch = $supplyItem->batch;
                if ($batch) {
                    $batch->update([
                        'quantity_available' => (int) $batch->quantity_available + (int) $supplyItem->batch_quantity_used,
                    ]);
                    if ($batch->product) {
                        $this->syncProductStockFromBatches($batch->product);
                    }
                }
            }
            return;
        }

        foreach ($walkInSale->items as $item) {
            $inv = $item->inventory;
            if (!$inv || $inv->stock_quantity === null) {
                continue;
            }

            $inv->update([
                'stock_quantity' => $inv->stock_quantity + $item->quantity,
                'is_active' => true,
            ]);
        }
    }

    private function nextReceiptNumber(): string
    {
        $prefix = 'WIS-' . now('Asia/Manila')->format('ym');

        $last = WalkInSale::where('receipt_number', 'like', "{$prefix}-%")
            ->orderByDesc('receipt_number')
            ->value('receipt_number');

        $next = 1;
        if ($last && preg_match('/-(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return sprintf('%s-%04d', $prefix, $next);
    }

    private function resolveRetailPromotion(?string $promotionId, Inventory $inventory): ?Promotion
    {
        if (!$promotionId) {
            return null;
        }

        $promotion = Promotion::query()
            ->availableOn(now('Asia/Manila')->toDateString())
            ->whereKey($promotionId)
            ->where(function ($query) use ($inventory) {
                $query->where('applies_to_all_inventory')
                    ->orWhereHas('inventoryItems', fn ($items) => $items->whereKey($inventory->id));
            })
            ->first();

        if (!$promotion) {
            throw ValidationException::withMessages([
                'items' => "The selected promotion is not valid for \"{$inventory->item_name}\".",
            ]);
        }

        return $promotion;
    }

    private function resolveBatchDeductions(Inventory $product, int $quantity, ?string $preferredBatchId = null): array
    {
        $this->ensureDefaultBatch($product);

        $query = InventoryBatch::query()
            ->where('product_id', $product->id)
            ->where('quantity_available', '>', 0)
            ->lockForUpdate();

        if ($preferredBatchId) {
            $query->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$preferredBatchId]);
        }

        $batches = $query
            ->orderByRaw('date_received IS NULL')
            ->orderBy('date_received')
            ->orderBy('batch_code')
            ->get();

        $remaining = $quantity;
        $deductions = [];
        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($remaining, (int) $batch->quantity_available);
            if ($take <= 0) {
                continue;
            }
            $deductions[] = ['batch' => $batch, 'quantity' => $take];
            $remaining -= $take;
        }

        return $deductions;
    }

    private function ensureDefaultBatch(Inventory $product): void
    {
        if ($product->batches()->exists() || $product->stock_quantity === null || $product->stock_quantity <= 0) {
            return;
        }

        $product->batches()->create([
            'batch_code' => $this->nextBatchLabel($product),
            'quantity_available' => (int) $product->stock_quantity,
            'expiration_date' => null,
            'date_received' => now('Asia/Manila')->toDateString(),
        ]);
    }

    private function nextBatchLabel(Inventory $product): string
    {
        $existing = $product->batches()->pluck('batch_code')->all();
        for ($index = 0; $index < 9999; $index++) {
            $label = $this->batchLabel($index);
            if (!in_array($label, $existing, true)) {
                return $label;
            }
        }
        return 'Batch - ' . str_pad((string) ((int) $product->batches()->count() + 1), 4, '0', STR_PAD_LEFT);
    }

    private function batchLabel(int $index): string
    {
        return 'Batch - ' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT);
    }

    private function syncProductStockFromBatches(Inventory $product): void
    {
        $quantity = (int) $product->batches()->sum('quantity_available');
        $product->update([
            'stock_quantity' => $quantity,
            'is_active' => $quantity > 0,
        ]);
    }

    private function serializeSupplySale(WalkInSale $sale): array
    {
        $supply = $sale->supply;
        $supplyItems = $supply
            ? $supply->supplyItems->map(fn (SupplyItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'batch_id' => $item->batch_id,
                'batch_code' => $item->batch?->batch_code,
                'product_name' => $item->product_name,
                'quantity_used' => $item->quantity_used,
                'unit_price' => $item->unit_price,
                'line_total' => $item->line_total,
                'expiration_date' => optional($item->expiration_date)->toDateString(),
                'batch_quantity_used' => $item->batch_quantity_used,
                // Backward-compatible aliases for current UI/report code.
                'inventory_id' => $item->product_id,
                'item_snapshot_name' => $item->product_name,
                'quantity' => $item->quantity_used,
                'selling_price' => $item->unit_price,
                'subtotal' => $item->line_total,
            ])->values()
            : $sale->items->map(fn (WalkInSaleItem $item) => [
                'id' => $item->id,
                'product_id' => $item->inventory_id,
                'batch_id' => null,
                'batch_code' => null,
                'product_name' => $item->item_snapshot_name,
                'quantity_used' => $item->quantity,
                'unit_price' => $item->selling_price,
                'line_total' => $item->subtotal,
                'expiration_date' => null,
                'batch_quantity_used' => $item->quantity,
                'inventory_id' => $item->inventory_id,
                'item_snapshot_name' => $item->item_snapshot_name,
                'quantity' => $item->quantity,
                'selling_price' => $item->selling_price,
                'subtotal' => $item->subtotal,
            ])->values();

        $payload = $sale->toArray();
        $payload['supply'] = [
            'id' => $supply?->id ?? $sale->id,
            'total_amount' => $supply?->total_amount ?? $sale->total_amount,
            'supply_items' => $supplyItems,
            'created_by' => $supply?->created_by ?? $sale->sold_by,
            'created_at' => optional($supply?->created_at ?? $sale->sold_at)->toISOString(),
            'updated_at' => optional($supply?->updated_at ?? $sale->updated_at)->toISOString(),
        ];
        $payload['supply_items'] = $supplyItems;
        $payload['items'] = $supplyItems;

        return $payload;
    }
}
