<?php

use App\Models\Project;
use App\Services\ProjectOrderService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migrates existing orders from the global `orders` table into
 * per-project `project_{id}_orders` tables and populates the
 * `order_registry` with global ID references.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Create per-project tables for every existing project
        $projects = Project::all();
        foreach ($projects as $project) {
            ProjectOrderService::createTableForProject($project);
        }

        // 2. Copy orders from global table into project tables + register in registry
        if (!Schema::hasTable('orders')) {
            return;
        }

        $orders = DB::table('orders')->orderBy('id')->get();

        foreach ($orders as $order) {
            $tableName = ProjectOrderService::getTableName($order->project_id);

            if (!Schema::hasTable($tableName)) {
                // Orphan order — create table on the fly
                $project = Project::find($order->project_id);
                if ($project) {
                    ProjectOrderService::createTableForProject($project);
                } else {
                    continue; // Skip orphan orders with no project
                }
            }

            // Insert into order_registry to reserve the same global ID
            DB::table('order_registry')->insert([
                'id' => $order->id,
                'project_id' => $order->project_id,
                'order_number' => $order->order_number,
                'created_at' => $order->created_at,
            ]);

            // Copy the full order row into the project table
            $orderData = (array) $order;
            DB::table($tableName)->insert($orderData);
        }

        // 3. Advance the auto-increment on order_registry past existing IDs
        $maxId = DB::table('order_registry')->max('id');
        if ($maxId) {
            DB::statement("ALTER TABLE order_registry AUTO_INCREMENT = " . ($maxId + 1));
        }

        // 4. Rename old orders table (keep as backup, don't drop)
        if (Schema::hasTable('orders')) {
            Schema::rename('orders', 'orders_backup');
        }
    }

    public function down(): void
    {
        // Restore the old orders table
        if (Schema::hasTable('orders_backup') && !Schema::hasTable('orders')) {
            Schema::rename('orders_backup', 'orders');
        }

        // Drop all per-project tables
        $projects = Project::all();
        foreach ($projects as $project) {
            ProjectOrderService::dropTableForProject($project->id);
        }

        // Clear order_registry
        DB::table('order_registry')->truncate();
    }
};
