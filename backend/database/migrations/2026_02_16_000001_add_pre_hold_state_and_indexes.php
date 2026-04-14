<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add pre_hold_state to orders so resume can return to the correct stage
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'pre_hold_state')) {
                $table->string('pre_hold_state', 30)->nullable()->after('hold_set_by');
            }
        });

        // Add missing indexes for performance
        Schema::table('help_requests', function (Blueprint $table) {
            $table->index('order_id');
            $table->index('project_id');
            $table->index('status');
        });

        Schema::table('issue_flags', function (Blueprint $table) {
            $table->index('order_id');
            $table->index('project_id');
            $table->index('status');
        });

        // Add index on users.role for frequent role-based queries
        Schema::table('users', function (Blueprint $table) {
            $table->index('role');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'pre_hold_state')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('pre_hold_state');
            });
        }

        // Must drop foreign keys before dropping their underlying indexes
        Schema::table('help_requests', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->dropForeign(['project_id']);
            $table->dropIndex(['order_id']);
            $table->dropIndex(['project_id']);
            $table->dropIndex(['status']);
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
        });

        Schema::table('issue_flags', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
            $table->dropForeign(['project_id']);
            $table->dropIndex(['order_id']);
            $table->dropIndex(['project_id']);
            $table->dropIndex(['status']);
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
        });
    }
};
