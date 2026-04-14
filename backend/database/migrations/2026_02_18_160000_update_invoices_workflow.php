<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add new columns for invoice workflow
        Schema::table('invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('invoices', 'issued_by')) {
                $table->foreignId('issued_by')->nullable()->constrained('users')->after('approved_at');
            }
            if (!Schema::hasColumn('invoices', 'issued_at')) {
                $table->timestamp('issued_at')->nullable()->after('issued_by');
            }
            if (!Schema::hasColumn('invoices', 'sent_at')) {
                $table->timestamp('sent_at')->nullable()->after('issued_at');
            }
            if (!Schema::hasColumn('invoices', 'locked_month_id')) {
                $table->foreignId('locked_month_id')->nullable()->constrained('month_locks')->after('sent_at');
            }
        });

        // Update status enum to include new workflow states
        DB::statement("ALTER TABLE invoices MODIFY COLUMN status ENUM('draft', 'pending_approval', 'prepared', 'approved', 'issued', 'sent') DEFAULT 'draft'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('issued_by');
            $table->dropColumn(['issued_at', 'sent_at']);
            $table->dropConstrainedForeignId('locked_month_id');
        });

        DB::statement("ALTER TABLE invoices MODIFY COLUMN status ENUM('draft', 'pending_approval', 'approved', 'sent') DEFAULT 'draft'");
    }
};
