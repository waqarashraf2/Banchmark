<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the global order_registry table.
 *
 * This table is the single source of truth for globally unique order IDs.
 * When an order is created, an entry is inserted here FIRST to get the
 * auto-incremented ID, then the order data goes into `project_{id}_orders`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_registry', function (Blueprint $table) {
            $table->id(); // Global auto-increment ID
            $table->unsignedBigInteger('project_id');
            $table->string('order_number', 191);
            $table->timestamp('created_at')->nullable();

            $table->index('project_id');
            $table->unique('order_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_registry');
    }
};
