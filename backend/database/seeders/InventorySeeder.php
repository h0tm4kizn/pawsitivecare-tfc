<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    /**
     * Add physical inventory items here.
     *
     * Format:
     * ['item_id' => 'GS-0001', 'category' => 'Grooming Supplies', 'name' => 'Pet Shampoo', 'price' => 100.00, 'stock_quantity' => 5]
     * ['category' => 'Medicine', 'name' => 'Wound Spray', 'price' => 150.00, 'stock_quantity' => 10]
     */
    private const INVENTORY_ITEMS = [
        ['item_id' => 'DF-0001', 'category' => 'Dog Food', 'name' => 'Bowi Dog Wet Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0002', 'category' => 'Dog Food', 'name' => 'Special Dog Wet Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0003', 'category' => 'Dog Food', 'name' => 'Pedigree Adult & Puppy Dog Wet Food Pouch', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0004', 'category' => 'Dog Food', 'name' => 'Signature Real Meat Dog Wet Food Pouch', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0005', 'category' => 'Dog Food', 'name' => 'Cesar Dog Wet Food Pouch', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0006', 'category' => 'Dog Food', 'name' => 'Cravy Pate Dog Food Pouch', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0007', 'category' => 'Dog Food', 'name' => 'Bowi Dog Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0008', 'category' => 'Dog Food', 'name' => 'Natura Savory Beef All Life Stages Dog Food (Dry Kibble Bags)', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0009', 'category' => 'Dog Food', 'name' => 'Holistic Dog Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0010', 'category' => 'Dog Food', 'name' => 'Pedigree Dog Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0011', 'category' => 'Dog Food', 'name' => 'Special Dog Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'DF-0012', 'category' => 'Dog Food', 'name' => 'Top Breed Dog Food', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'CF-0001', 'category' => 'Cat Food', 'name' => 'Special Cat Chicken Heart & Liver (Wet Food Cans)', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0002', 'category' => 'Cat Food', 'name' => 'Bowi Cat Wet Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0003', 'category' => 'Cat Food', 'name' => 'Signature Real Meat Cat Wet Food Pouch', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0004', 'category' => 'Cat Food', 'name' => 'Signature Real Meat Cat Wet Food Cans', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0005', 'category' => 'Cat Food', 'name' => 'Pate Cat Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0006', 'category' => 'Cat Food', 'name' => 'Bowi Cat Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0007', 'category' => 'Cat Food', 'name' => 'Neravit Tuna Steak', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0008', 'category' => 'Cat Food', 'name' => 'Smartheart Cat Food', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CF-0009', 'category' => 'Cat Food', 'name' => 'Special Cat Food', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'SUP-0001', 'category' => 'Supplements', 'name' => 'Goats Milk Powder', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0002', 'category' => 'Supplements', 'name' => 'LC-Vit Syrup Multivitamin', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0003', 'category' => 'Supplements', 'name' => 'LC-Vit Plus Syrup Multivitamin', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0004', 'category' => 'Supplements', 'name' => 'Coatshine Omega Fatty Acid', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0005', 'category' => 'Supplements', 'name' => 'LC-Scour', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0006', 'category' => 'Supplements', 'name' => 'Livotine Syrup', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0007', 'category' => 'Supplements', 'name' => 'Nutrical', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0008', 'category' => 'Supplements', 'name' => 'Hepacare-D', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0009', 'category' => 'Supplements', 'name' => 'LC-DOC Doxycycline', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0010', 'category' => 'Supplements', 'name' => 'D-Glucose Monohydrate', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0011', 'category' => 'Supplements', 'name' => 'Moringa Powder', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0012', 'category' => 'Supplements', 'name' => 'Fluralaner Bravecto', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SUP-0013', 'category' => 'Supplements', 'name' => 'Nexgard (Flea-Tick Preventive Tablets)', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'PA-0001', 'category' => 'Pet Accessories', 'name' => 'Cat Leash', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0002', 'category' => 'Pet Accessories', 'name' => 'Dog Leash', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0003', 'category' => 'Pet Accessories', 'name' => 'Harnesses & Collars', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0004', 'category' => 'Pet Accessories', 'name' => 'Pet Clothes & Bandanas', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0005', 'category' => 'Pet Accessories', 'name' => 'Nail Trim', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0006', 'category' => 'Pet Accessories', 'name' => 'Bottle Feeder', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0007', 'category' => 'Pet Accessories', 'name' => 'Portable Pet Bowl', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0008', 'category' => 'Pet Accessories', 'name' => 'E-Collar', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0009', 'category' => 'Pet Accessories', 'name' => 'Cat Litter Scoops', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0010', 'category' => 'Pet Accessories', 'name' => 'Pet Comb', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0011', 'category' => 'Pet Accessories', 'name' => 'Stainless Pet Bowl', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'PA-0012', 'category' => 'Pet Accessories', 'name' => 'Sipper Tube Bottle & Drip Bottle', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'TOY-0001', 'category' => 'Toys', 'name' => 'Stuffed Toys', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'TOY-0002', 'category' => 'Toys', 'name' => 'Cat Wand-Stick Toy', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'CB-0001', 'category' => 'Carrier Bag', 'name' => 'Pet Carrier Bag', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'CL-0001', 'category' => 'Cat Litter', 'name' => 'Signature Tofu Litter', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'CL-0002', 'category' => 'Cat Litter', 'name' => 'Wood Shavings & Bedding Packs', 'price' => 100.00, 'stock_quantity' => 5],

        ['item_id' => 'SP-0001', 'category' => 'Soap Products', 'name' => 'Bio Sulfur Soap', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SP-0002', 'category' => 'Soap Products', 'name' => 'Fresh Paws Dog & Cats Herbal Soap', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SP-0003', 'category' => 'Soap Products', 'name' => 'Pet Shampoo with Conditioner', 'price' => 100.00, 'stock_quantity' => 5],
        ['item_id' => 'SP-0004', 'category' => 'Soap Products', 'name' => 'Carbaryl Bearing Tick & Flea Dog Powder', 'price' => 100.00, 'stock_quantity' => 5],
    ];

    public function run(): void
    {
        $this->seedInventoryItems();
    }

    private function seedInventoryItems(): void
    {
        $categoryCounts = [];

        foreach (self::INVENTORY_ITEMS as $row) {
            $name = trim((string) ($row['name'] ?? $row['item_name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $category = trim((string) ($row['category'] ?? 'General'));
            $categoryCode = $this->categoryCode($category);
            $categoryCounts[$categoryCode] = ($categoryCounts[$categoryCode] ?? 0) + 1;
            $itemId = $row['item_id'] ?? sprintf('%s-%04d', $categoryCode, $categoryCounts[$categoryCode]);

            $values = [
                'item_name' => $name,
                'item_type' => 'product',
                'category' => $category,
                'cost_price' => (float) ($row['cost_price'] ?? 80),
                'selling_price' => (float) ($row['price'] ?? $row['selling_price'] ?? $row['unit_price'] ?? 0),
                'stock_quantity' => $row['stock_quantity'] ?? null,
                'is_active' => (bool) ($row['is_active'] ?? true),
                'description' => $row['description'] ?? null,
            ];

            if (array_key_exists('image_url', $row)) {
                $values['image_url'] = $row['image_url'];
            }

            $inventory = Inventory::query()->updateOrCreate(
                ['item_id' => $itemId],
                $values
            );

            $stockQuantity = (int) ($values['stock_quantity'] ?? 0);
            if ($stockQuantity > 0) {
                $inventory->batches()->updateOrCreate(
                    ['batch_code' => 'Batch - 0001'],
                    [
                        'quantity_available' => $stockQuantity,
                        'expiration_date' => null,
                        'date_received' => now('Asia/Manila')->toDateString(),
                    ]
                );
            }
        }
    }

    private function categoryCode(string $category): string
    {
        $words = preg_split('/[^A-Za-z0-9]+/', strtoupper($category), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($words) === 1) {
            return substr($words[0], 0, 3) ?: 'INV';
        }

        $code = implode('', array_map(fn (string $word): string => $word[0], $words));
        return substr($code, 0, 6) ?: 'INV';
    }
}
