<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('inventory')) {
            Schema::create('inventory', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('item_id')->unique();
                $table->string('item_name', 150);
                $table->string('item_type', 30)->default('product');
                $table->string('category')->nullable();
                $table->string('barcode')->nullable()->unique();
                $table->decimal('cost_price', 12, 2)->default(0);
                $table->decimal('selling_price', 12, 2)->default(0);
                $table->integer('stock_quantity')->nullable();
                $table->string('image_url')->nullable();
                $table->boolean('is_active')->default(true);
                $table->text('description')->nullable();
                $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['item_type', 'is_active']);
                $table->index('category');
                $table->index('item_name');
            });
        }

        if (!Schema::hasTable('inventory_batches')) {
            Schema::create('inventory_batches', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('product_id')->constrained('inventory')->cascadeOnDelete();
                $table->string('batch_code', 64);
                $table->unsignedInteger('quantity_available')->default(0);
                $table->date('expiration_date')->nullable();
                $table->date('date_received')->nullable();
                $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['product_id', 'batch_code']);
                $table->index(['product_id', 'expiration_date']);
                $table->index('batch_code');
            });
        }

        if (!Schema::hasTable('walk_in_sales')) {
            Schema::create('walk_in_sales', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('receipt_number', 32)->unique();
                $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
                $table->string('customer_name', 150)->nullable();
                $table->decimal('total_amount', 12, 2)->default(0);
                $table->string('payment_method', 30)->nullable();
                $table->string('payment_channel', 60)->nullable();
                $table->string('reference_number', 100)->nullable();
                $table->text('notes')->nullable();
                $table->foreignUuid('sold_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('sold_at')->useCurrent();
                $table->timestamp('voided_at')->nullable();
                $table->foreignUuid('voided_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index('appointment_id');
                $table->index('sold_at');
                $table->index('receipt_number');
                $table->index('voided_at');
            });
        }

        if (!Schema::hasTable('walk_in_sale_items')) {
            Schema::create('walk_in_sale_items', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('walk_in_sale_id')->constrained('walk_in_sales')->cascadeOnDelete();
                $table->foreignUuid('inventory_id')->nullable()->constrained('inventory')->nullOnDelete();
                $table->string('item_snapshot_id')->nullable();
                $table->string('item_snapshot_name', 150);
                $table->decimal('cost_price_snapshot', 12, 2)->nullable();
                $table->unsignedInteger('quantity')->default(1);
                $table->decimal('selling_price', 12, 2)->default(0);
                $table->decimal('subtotal', 12, 2)->default(0);

                $table->index('walk_in_sale_id');
                $table->index('inventory_id');
            });
        }

        if (!Schema::hasTable('supplies')) {
            Schema::create('supplies', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('walk_in_sale_id')->nullable()->constrained('walk_in_sales')->nullOnDelete();
                $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->nullOnDelete();
                $table->decimal('total_amount', 12, 2)->default(0);
                $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index('walk_in_sale_id');
                $table->index('appointment_id');
                $table->index('created_by');
            });
        }

        if (!Schema::hasTable('supply_items')) {
            Schema::create('supply_items', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('supply_id')->constrained('supplies')->cascadeOnDelete();
                $table->foreignUuid('product_id')->nullable()->constrained('inventory')->nullOnDelete();
                $table->foreignUuid('batch_id')->nullable()->constrained('inventory_batches')->nullOnDelete();
                $table->string('product_name', 150);
                $table->unsignedInteger('quantity_used')->default(1);
                $table->decimal('unit_price', 12, 2)->default(0);
                $table->decimal('line_total', 12, 2)->default(0);
                $table->date('expiration_date')->nullable();
                $table->unsignedInteger('batch_quantity_used')->default(1);
                $table->timestamps();

                $table->index('supply_id');
                $table->index('product_id');
                $table->index('batch_id');
                $table->index('expiration_date');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('supply_items');
        Schema::dropIfExists('supplies');
        Schema::dropIfExists('walk_in_sale_items');
        Schema::dropIfExists('walk_in_sales');
        Schema::dropIfExists('inventory_batches');
        Schema::dropIfExists('inventory');
    }
};
