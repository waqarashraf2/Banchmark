<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Add project_manager role and create pivot table for PM ↔ Project assignment.
 * A PM can manage multiple projects; a project can have multiple PMs.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Add project_manager to the role enum
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','project_manager','drawer','checker','qa','designer','accounts_manager') NOT NULL");

        // 2. Create pivot table for PM ↔ Project many-to-many
        Schema::create('project_manager_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('project_id');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade');
            $table->unique(['user_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_manager_projects');
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','drawer','checker','qa','designer','accounts_manager') NOT NULL");
    }
};
