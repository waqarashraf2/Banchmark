<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Live QA System:
 * 1. Add 'live_qa' to user role enum
 * 2. Create shared product_checklists table (checklist item definitions)
 * 3. Per-project mistake tables will be created via ProjectOrderService
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Add live_qa role to users table
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','project_manager','drawer','checker','qa','designer','accounts_manager','live_qa') NOT NULL");

        // 2. Create product_checklists table (shared across projects)
        // This replaces the old Metro system's product_checklist table
        if (!Schema::hasTable('product_checklists')) {
            Schema::create('product_checklists', function (Blueprint $table) {
                $table->id();
                $table->string('client', 500)->nullable()->comment('Client/category e.g. Schematic');
                $table->string('product', 500)->nullable()->comment('Product type e.g. FP');
                $table->string('title', 500)->comment('Checklist item title');
                $table->integer('check_list_type_id')->default(0)->comment('1=drawer, 2=checker, 3=qa');
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->unsignedBigInteger('created_by')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','director','operations_manager','project_manager','drawer','checker','qa','designer','accounts_manager') NOT NULL");
        Schema::dropIfExists('product_checklists');
    }
};
