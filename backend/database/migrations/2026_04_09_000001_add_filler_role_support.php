<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','project_manager','drawer','checker','filler','qa','designer','accounts_manager','live_qa') NOT NULL");
        DB::statement("ALTER TABLE users MODIFY COLUMN layer ENUM('drawer','checker','filler','qa','designer') NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','project_manager','drawer','checker','qa','designer','accounts_manager','live_qa') NOT NULL");
        DB::statement("ALTER TABLE users MODIFY COLUMN layer ENUM('drawer','checker','qa','designer') NULL");
    }
};
