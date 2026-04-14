<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Smart Assignment System — Phase 1, 2 & 3 schema changes.
 *
 * Users:   wip_limit, avg_completion_minutes, rejection_rate_30d, skills, assignment_score
 * Orders:  complexity_weight, order_type, estimated_minutes
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── USERS: per-user assignment intelligence ──
        Schema::table('users', function (Blueprint $table) {
            // Phase 1: per-user WIP limit (replaces project-wide wip_cap for assignment)
            $table->unsignedSmallInteger('wip_limit')->default(5)->after('wip_count');

            // Phase 2: rolling performance metrics (updated by ComputeWorkerStats job)
            $table->decimal('avg_completion_minutes', 8, 2)->default(0)->after('daily_target');
            $table->decimal('rejection_rate_30d', 5, 4)->default(0)->after('avg_completion_minutes');

            // Phase 2: cached composite assignment score (higher = more available)
            $table->decimal('assignment_score', 8, 4)->default(0)->after('rejection_rate_30d');

            // Phase 3: skill tags for order-type matching
            $table->json('skills')->nullable()->after('assignment_score');

            // Index for fast worker selection
            $table->index(['project_id', 'role', 'is_active', 'is_absent', 'assignment_score'], 'idx_smart_assignment');
        });

        // ── PROJECT ORDER TABLES: add complexity_weight, order_type, estimated_minutes ──
        // We add these to all existing project_*_orders tables dynamically
        $projectTables = \Illuminate\Support\Facades\DB::table('projects')->pluck('id');
        foreach ($projectTables as $projectId) {
            $tableName = "project_{$projectId}_orders";
            if (!Schema::hasTable($tableName)) continue;

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::hasColumn($tableName, 'complexity_weight')) {
                    $table->unsignedSmallInteger('complexity_weight')->default(1)->after('priority');
                }
                if (!Schema::hasColumn($tableName, 'estimated_minutes')) {
                    $table->unsignedInteger('estimated_minutes')->nullable()->after('complexity_weight');
                }
                if (!Schema::hasColumn($tableName, 'order_type')) {
                    $table->string('order_type', 50)->default('standard')->after('estimated_minutes');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_smart_assignment');
            $table->dropColumn([
                'wip_limit', 'avg_completion_minutes', 'rejection_rate_30d',
                'assignment_score', 'skills',
            ]);
        });

        $projectTables = \Illuminate\Support\Facades\DB::table('projects')->pluck('id');
        foreach ($projectTables as $projectId) {
            $tableName = "project_{$projectId}_orders";
            if (!Schema::hasTable($tableName)) continue;

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $cols = [];
                if (Schema::hasColumn($tableName, 'complexity_weight')) $cols[] = 'complexity_weight';
                if (Schema::hasColumn($tableName, 'estimated_minutes')) $cols[] = 'estimated_minutes';
                if (Schema::hasColumn($tableName, 'order_type')) $cols[] = 'order_type';
                if (!empty($cols)) $table->dropColumn($cols);
            });
        }
    }
};
