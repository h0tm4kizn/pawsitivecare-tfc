<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('walk_in_sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('receipt_number', 32)->unique();
            $table->string('customer_name', 150)->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('payment_method', 30)->default('cash');
            $table->text('notes')->nullable();
            $table->foreignUuid('sold_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sold_at')->useCurrent();
            $table->timestamps();

            $table->index('sold_at');
            $table->index('receipt_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('walk_in_sales');
    }
};
