<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('appointment_id')->constrained('appointments')->cascadeOnDelete();
            $table->foreignUuid('master_item_id')->nullable()->constrained('master_items')->nullOnDelete();
            $table->enum('line_type', ['service', 'retail', 'adjustment'])->default('service');
            $table->string('item_snapshot_id', 32)->nullable();    // snapshot of item_id at billing time
            $table->string('item_snapshot_name', 150)->nullable(); // snapshot of item_name at billing time
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('subtotal', 12, 2);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('appointment_id');
            $table->index('line_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_ledger');
    }
};

