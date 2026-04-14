<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('queue_name', 100)->nullable()->after('name');
            $table->index('queue_name');
        });

        // Set default queue_name = project name for all existing projects
        DB::table('projects')->whereNull('queue_name')->update([
            'queue_name' => DB::raw('name'),
        ]);
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropIndex(['queue_name']);
            $table->dropColumn('queue_name');
        });
    }
};
