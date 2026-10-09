<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function publicCatalog()
    {
        $items = Inventory::query()
            ->where('item_type', 'product')
            ->where('is_active', true)
            ->select('id', 'item_name', 'selling_price', 'image_url')
            ->orderBy('item_name')
            ->get();

        return $this->success($items, 'Supplies catalog retrieved successfully.');
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $category = trim((string) $request->query('category', ''));
        // Interactive screens are capped. Full exports/reports must opt in
        // explicitly so they retain complete-data semantics.
        $perPage = $request->boolean('all')
            ? 10000
            : max(1, min((int) $request->query('per_page', 25), 100));
        $page = max(1, (int) $request->query('page', 1));

        $query = Inventory::query()
            ->select(['id', 'item_id', 'item_name', 'item_type', 'category', 'barcode', 'cost_price', 'selling_price', 'stock_quantity', 'image_url', 'is_active', 'description', 'created_at', 'updated_at'])
            ->with(['batches' => fn ($q) => $q
                ->select(['id', 'product_id', 'batch_code', 'quantity_available', 'expiration_date', 'date_received'])
                ->orderByRaw('date_received IS NULL')
                ->orderBy('date_received')
                ->orderBy('batch_code')])
            ->where('item_type', 'product')
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner
                        ->where('item_id', 'ilike', "%{$search}%")
                        ->orWhere('barcode', 'ilike', "%{$search}%")
                        ->orWhere('item_name', 'ilike', "%{$search}%")
                        ->orWhere('category', 'ilike', "%{$search}%");
                });
            })
            ->when($category !== '', fn ($q) => $q->where('category', $category))
            ->orderBy('category')
            ->orderBy('item_id');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        $baseStats = Inventory::query()->where('item_type', 'product');
        $stats = [
            'total_products' => (clone $baseStats)->where('is_active', true)->count(),
            'categories' => (clone $baseStats)->where('is_active', true)->distinct('category')->count('category'),
            'stock_value' => (float) (clone $baseStats)
                ->where('is_active', true)
                ->selectRaw('COALESCE(SUM(cost_price * COALESCE(stock_quantity, 0)), 0) as total')
                ->value('total'),
            'low_or_no_stock' => (clone $baseStats)
                ->where('is_active', true)
                ->where(fn ($q) => $q->whereNull('stock_quantity')->orWhere('stock_quantity', '<=', 3))
                ->count(),
            'next_item_code' => $this->nextItemCode(),
        ];

        $categories = Inventory::query()
            ->where('item_type', 'product')
            ->where('is_active', true)
            ->select('category', DB::raw('count(*) as total'))
            ->groupBy('category')
            ->orderBy('category')
            ->get();

        return $this->success([
            'items' => $paginated->items(),
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'stats' => $stats,
            'categories' => $categories,
        ], 'Inventory products retrieved successfully.');
    }

    public function store(Request $request)
    {
        if ($response = $this->ensureAdminInventoryWrite()) {
            return $response;
        }

        $validated = $request->validate([
            'item_name' => 'required|string|max:150',
            'category' => 'required|string|max:255',
            'barcode' => ['nullable', 'string', 'max:255', Rule::unique('inventory', 'barcode')],
            'cost_price' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'description' => 'nullable|string|max:1000',
            'batches' => 'nullable|array',
            'batches.*.id' => 'nullable|uuid|exists:inventory_batches,id',
            'batches.*.batch_code' => 'nullable|string|max:64',
            'batches.*.quantity_available' => 'required_with:batches|integer|min:0',
            'batches.*.expiration_date' => 'nullable|date',
            'batches.*.date_received' => 'nullable|date',
        ]);

        $category = trim($validated['category']);
        $stockQuantity = $validated['stock_quantity'] ?? null;
        $barcode = trim((string) ($validated['barcode'] ?? ''));

        $inventory = Inventory::query()->create([
            'item_id' => $this->nextItemCode(),
            'item_name' => trim($validated['item_name']),
            'item_type' => 'product',
            'category' => $category,
            'barcode' => $barcode !== '' ? $barcode : null,
            'cost_price' => (float) $validated['cost_price'],
            'selling_price' => (float) $validated['selling_price'],
            'stock_quantity' => $stockQuantity,
            'description' => $validated['description'] ?? null,
            'is_active' => ((int) ($stockQuantity ?? 0)) > 0,
            'created_by' => Auth::id(),
            'updated_by' => Auth::id(),
        ]);

        $this->syncBatchesFromPayload($inventory, $validated['batches'] ?? null, $stockQuantity);

        return $this->success($inventory->fresh('batches'), 'Inventory item created successfully.', 201);
    }

    public function lookupBarcode(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:255',
        ]);

        $barcode = trim($validated['code']);
        if ($barcode === '') {
            return $this->error('Barcode is required.', 422);
        }

        $inventory = Inventory::query()
            ->with(['batches' => fn ($q) => $q
                ->orderByRaw('date_received IS NULL')
                ->orderBy('date_received')
                ->orderBy('batch_code')])
            ->where('item_type', 'product')
            ->where('barcode', $barcode)
            ->first();

        if (! $inventory) {
            return $this->error('No inventory item found for this barcode.', 404);
        }

        return $this->success($inventory, 'Inventory item found.');
    }

    public function update(Request $request, Inventory $inventory)
    {
        if ($response = $this->ensureAdminInventoryWrite()) {
            return $response;
        }

        if ($inventory->item_type !== 'product') {
            return $this->error('Only product inventory items can be edited here.', 422);
        }

        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'barcode' => ['nullable', 'string', 'max:255', Rule::unique('inventory', 'barcode')->ignore($inventory->id)],
            'cost_price' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'description' => 'nullable|string|max:1000',
            'batches' => 'nullable|array',
            'batches.*.id' => 'nullable|uuid|exists:inventory_batches,id',
            'batches.*.batch_code' => 'nullable|string|max:64',
            'batches.*.quantity_available' => 'required_with:batches|integer|min:0',
            'batches.*.expiration_date' => 'nullable|date',
            'batches.*.date_received' => 'nullable|date',
        ]);

        $stockQuantity = $validated['stock_quantity'] ?? null;
        $barcode = trim((string) ($validated['barcode'] ?? ''));

        $inventory->update([
            'item_name' => trim($validated['item_name']),
            'category' => trim($validated['category']),
            'barcode' => $barcode !== '' ? $barcode : null,
            'cost_price' => (float) $validated['cost_price'],
            'selling_price' => (float) $validated['selling_price'],
            'stock_quantity' => $stockQuantity,
            'description' => $validated['description'] ?? null,
            'is_active' => ((int) ($stockQuantity ?? 0)) > 0,
            'updated_by' => Auth::id(),
        ]);

        $this->syncBatchesFromPayload($inventory, $validated['batches'] ?? null, $stockQuantity);

        return $this->success($inventory->fresh('batches'), 'Inventory item updated successfully.');
    }

    public function destroy(Inventory $inventory)
    {
        if ($response = $this->ensureAdminInventoryWrite()) {
            return $response;
        }

        if ($inventory->item_type !== 'product') {
            return $this->error('Only product inventory items can be deleted here.', 422);
        }

        $oldUrl = $inventory->image_url;
        $inventory->delete();

        if ($oldUrl) {
            $this->deleteInventoryImageFromStorage($oldUrl);
        }

        return $this->success(null, 'Inventory item deleted successfully.');
    }

    public function uploadImage(Request $request, Inventory $inventory)
    {
        if ($response = $this->ensureAdminInventoryWrite()) {
            return $response;
        }

        if ($inventory->item_type !== 'product') {
            return $this->error('Only product inventory items can have product images.', 422);
        }

        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120',
        ], [
            'image.required' => 'A product image file is required.',
            'image.image' => 'The file must be an image.',
            'image.max' => 'Image must not exceed 5 MB.',
        ]);

        $file = $request->file('image');
        $ext = $file->getClientOriginalExtension();
        $oldUrl = $inventory->image_url;
        $path = 'inventory/photos/' . $inventory->id . '-' . now()->format('YmdHisv') . '.' . $ext;
        $disk = $this->storageDisk();

        Storage::disk($disk)->put(
            $path,
            file_get_contents($file->getRealPath()),
            'public'
        );

        $url = $this->storageUrl($disk, $path, $request);
        $inventory->update(['image_url' => $url]);

        if ($oldUrl && $oldUrl !== $url) {
            $this->deleteInventoryImageFromStorage($oldUrl);
        }

        return $this->success([
            'image_url' => $url,
            'item' => $inventory->fresh(),
        ], 'Inventory image uploaded successfully.');
    }

    private function ensureAdminInventoryWrite()
    {
        if (! Auth::user()?->isAdmin()) {
            return $this->error('Only admins can change inventory items, prices, costs, stock, or product images.', 403);
        }

        return null;
    }

    private function storageDisk(): string
    {
        if (! config('filesystems.disks.supabase.key')) {
            return 'public';
        }

        try {
            Storage::disk('supabase');
            return 'supabase';
        } catch (\Throwable) {
            return 'public';
        }
    }

    private function storageUrl(string $disk, string $path, ?Request $request = null): string
    {
        if ($disk === 'public') {
            $relative = Storage::disk('public')->url($path);
            if ($request) {
                return rtrim($request->getSchemeAndHttpHost(), '/') . $relative;
            }
            return $relative;
        }

        $base = rtrim((string) config('filesystems.disks.supabase.public_url'), '/');
        if ($base === '') {
            $endpoint = (string) config('filesystems.disks.supabase.endpoint', '');
            $base = preg_replace('#/storage/v1/s3/?$#', '', rtrim($endpoint, '/'));
        }
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare');
        return "{$base}/storage/v1/object/public/{$bucket}/{$path}";
    }

    private function deleteInventoryImageFromStorage(?string $imageUrl): void
    {
        if (! $imageUrl) {
            return;
        }

        $disk = $this->storageDisk();
        $bucket = config('filesystems.disks.supabase.bucket', 'pawsitivecare');
        $marker = $disk === 'supabase'
            ? "/storage/v1/object/public/{$bucket}/"
            : '/storage/';

        $pos = strpos($imageUrl, $marker);
        if ($pos === false) {
            return;
        }

        $path = strtok(substr($imageUrl, $pos + strlen($marker)), '?');
        if (! str_starts_with($path, 'inventory/photos/')) {
            return;
        }

        try {
            Storage::disk($disk)->delete($path);
        } catch (\Throwable) {
            // Old image cleanup is non-fatal.
        }
    }

    private function nextItemCode(): string
    {
        $lastItemId = Inventory::query()
            ->where('item_type', 'product')
            ->where('item_id', 'like', 'ITEM-%')
            ->orderByDesc('item_id')
            ->value('item_id');

        $nextNumber = 1;
        if ($lastItemId && preg_match('/-(\d+)$/', $lastItemId, $matches)) {
            $nextNumber = ((int) $matches[1]) + 1;
        }

        do {
            $itemId = sprintf('ITEM-%04d', $nextNumber);
            $nextNumber++;
        } while (Inventory::query()->where('item_id', $itemId)->exists());

        return $itemId;
    }

    private function syncBatchesFromPayload(Inventory $inventory, ?array $batches, mixed $stockQuantity): void
    {
        if (is_array($batches)) {
            $keepIds = collect($batches)->pluck('id')->filter()->values()->all();
            $inventory->batches()
                ->when(!empty($keepIds), fn ($q) => $q->whereNotIn('id', $keepIds))
                ->delete();

            foreach ($batches as $index => $batch) {
                $payload = [
                    'quantity_available' => (int) $batch['quantity_available'],
                    'expiration_date' => $batch['expiration_date'] ?? null,
                    'date_received' => $batch['date_received'] ?? now('Asia/Manila')->toDateString(),
                    'updated_by' => Auth::id(),
                ];

                if (!empty($batch['id'])) {
                    $inventory->batches()->whereKey($batch['id'])->update($payload);
                    continue;
                }

                $payload['batch_code'] = trim((string) ($batch['batch_code'] ?? '')) !== ''
                    ? trim((string) $batch['batch_code'])
                    : $this->nextBatchLabel($inventory);
                $payload['created_by'] = Auth::id();

                $inventory->batches()->create($payload);
            }
            $quantity = (int) $inventory->batches()->sum('quantity_available');
            $inventory->update([
                'stock_quantity' => $quantity,
                'is_active' => $quantity > 0,
            ]);
            return;
        }

        if ($stockQuantity === null) {
            return;
        }

        $existingBatches = $inventory->batches()->count();
        if ($existingBatches > 1) {
            $quantity = (int) $inventory->batches()->sum('quantity_available');
            $inventory->update([
                'stock_quantity' => $quantity,
                'is_active' => $quantity > 0,
            ]);
            return;
        }

        $batch = $inventory->batches()->first();
        $payload = [
            'batch_code' => $batch?->batch_code ?: $this->nextBatchLabel($inventory),
            'quantity_available' => (int) $stockQuantity,
            'expiration_date' => $batch?->expiration_date,
            'date_received' => $batch?->date_received ?? now('Asia/Manila')->toDateString(),
            'updated_by' => Auth::id(),
        ];

        if ($batch) {
            $batch->update($payload);
        } elseif ((int) $stockQuantity > 0) {
            $payload['created_by'] = Auth::id();
            $inventory->batches()->create($payload);
        }
    }

    private function nextBatchLabel(Inventory $inventory): string
    {
        $existing = $inventory->batches()->pluck('batch_code')->all();
        for ($index = 0; $index < 9999; $index++) {
            $label = $this->batchLabel($index);
            if (!in_array($label, $existing, true)) {
                return $label;
            }
        }
        return 'Batch - ' . str_pad((string) ((int) $inventory->batches()->count() + 1), 4, '0', STR_PAD_LEFT);
    }

    private function batchLabel(int $index): string
    {
        return 'Batch - ' . str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT);
    }
}
