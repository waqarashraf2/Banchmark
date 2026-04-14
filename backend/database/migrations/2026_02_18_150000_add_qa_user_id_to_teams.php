<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Team Hierarchy:
     * - Each team has exactly 1 QA as the team lead (qa_user_id)
     * - Team members (checkers, drawers, designers) belong to the team via their team_id
     * - Floor Plan: QA → multiple Checkers → multiple Drawers
     * - Photos Enhancement: QA → multiple Designers
     */
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            // QA user who leads this team
            $table->foreignId('qa_user_id')->nullable()->after('project_id')->constrained('users')->nullOnDelete();
            
            // Index for finding teams by QA
            $table->index('qa_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropForeign(['qa_user_id']);
            $table->dropColumn('qa_user_id');
        });
    }
};
