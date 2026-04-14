<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds columns from the old Benchmark system for compatibility.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Address and client info (from old system)
            $table->string('address', 255)->nullable()->after('client_reference');
            $table->string('client_name', 255)->nullable()->after('address');
            
            // Date fields (for legacy data compatibility)
            $table->integer('year')->nullable()->after('due_date');
            $table->integer('month')->nullable()->after('year');
            $table->string('date', 255)->nullable()->after('month'); // Legacy date string format
            $table->timestamp('ausDatein')->nullable()->after('date'); // Australian date-in timestamp
            
            // Order classification fields
            $table->string('code', 255)->nullable()->after('ausDatein'); // e.g., 'FP&SP'
            $table->string('plan_type', 255)->nullable()->after('code'); // e.g., 'Colour', 'Black&White'
            $table->string('instruction', 255)->nullable()->after('plan_type');
            $table->string('project_type', 255)->nullable()->after('instruction'); // e.g., 'Romio'
            $table->string('due_in', 255)->nullable()->after('project_type'); // e.g., 'About 8 hours'
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'address',
                'client_name',
                'year',
                'month',
                'date',
                'ausDatein',
                'code',
                'plan_type',
                'instruction',
                'project_type',
                'due_in',
            ]);
        });
    }
};
