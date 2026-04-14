<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds QA supervisor assignment for PM → QA → Drawer workflow
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('qa_supervisor_id')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
            $table->index(['qa_supervisor_id', 'workflow_state']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['qa_supervisor_id']);
            $table->dropColumn('qa_supervisor_id');
        });
    }
};
