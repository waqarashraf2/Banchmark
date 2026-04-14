<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('crm_order_assignments')) {
            return;
        }

        Schema::table('crm_order_assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('crm_order_assignments', 'current_layer')) {
                $table->string('current_layer', 20)->nullable()->after('workflow_state');
            }
            if (!Schema::hasColumn('crm_order_assignments', 'file_uploader_id')) {
                $table->unsignedInteger('file_uploader_id')->nullable()->after('checker_name');
            }
            if (!Schema::hasColumn('crm_order_assignments', 'file_uploader_name')) {
                $table->string('file_uploader_name')->nullable()->after('file_uploader_id');
            }
            if (!Schema::hasColumn('crm_order_assignments', 'fassign_time')) {
                $table->dateTime('fassign_time')->nullable()->after('cassign_time');
            }
            if (!Schema::hasColumn('crm_order_assignments', 'file_uploaded')) {
                $table->string('file_uploaded', 10)->nullable()->after('checker_done');
            }
            if (!Schema::hasColumn('crm_order_assignments', 'file_upload_date')) {
                $table->dateTime('file_upload_date')->nullable()->after('checker_date');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('crm_order_assignments')) {
            return;
        }

        Schema::table('crm_order_assignments', function (Blueprint $table) {
            $dropColumns = [];

            foreach ([
                'current_layer',
                'file_uploader_id',
                'file_uploader_name',
                'fassign_time',
                'file_uploaded',
                'file_upload_date',
            ] as $column) {
                if (Schema::hasColumn('crm_order_assignments', $column)) {
                    $dropColumns[] = $column;
                }
            }

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
