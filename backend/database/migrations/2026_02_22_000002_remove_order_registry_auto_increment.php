<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Convert project_*_orders tables from manual-ID to auto-increment
 * and drop the order_registry table (no longer needed).
 *
 * Each project table gets its own independent auto-increment sequence.
 * IDs are NOT globally unique — orders are identified by (project_id, id).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Convert each project order table to auto-increment
        $tables = DB::select("SHOW TABLES LIKE 'project_%_orders'");

        foreach ($tables as $row) {
            $tableName = array_values((array) $row)[0];

            // Get current max ID to set auto-increment start
            $maxId = DB::table($tableName)->max('id') ?? 0;
            $nextId = $maxId + 1;

            // Change column from unsigned bigint to auto-increment
            DB::statement("ALTER TABLE `{$tableName}` MODIFY `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT");

            // Set auto-increment start past existing IDs
            if ($maxId > 0) {
                DB::statement("ALTER TABLE `{$tableName}` AUTO_INCREMENT = {$nextId}");
            }
        }

        // 2. Drop the order_registry table
        Schema::dropIfExists('order_registry');
    }

    public function down(): void
    {
        // Recreate order_registry
        Schema::create('order_registry', function ($table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->string('order_number', 191);
            $table->timestamp('created_at')->nullable();
            $table->index('project_id');
            $table->unique('order_number');
        });

        // Repopulate registry from existing project tables
        $tables = DB::select("SHOW TABLES LIKE 'project_%_orders'");
        foreach ($tables as $row) {
            $tableName = array_values((array) $row)[0];
            $orders = DB::table($tableName)->select('id', 'project_id', 'order_number', 'created_at')->get();
            foreach ($orders as $order) {
                DB::table('order_registry')->insert([
                    'id' => $order->id,
                    'project_id' => $order->project_id,
                    'order_number' => $order->order_number,
                    'created_at' => $order->created_at,
                ]);
            }
        }

        // Revert tables back to non-auto-increment
        foreach ($tables as $row) {
            $tableName = array_values((array) $row)[0];
            DB::statement("ALTER TABLE `{$tableName}` MODIFY `id` BIGINT UNSIGNED NOT NULL");
        }
    }
};
