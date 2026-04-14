<?php
// Add standard worker tracking columns to ALL project order tables
// Run: php add_columns_all_projects.php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

$columns = [
    'drawer_id'     => ['type' => 'integer', 'after' => 'assigned_to'],
    'drawer_name'   => ['type' => 'string',  'after' => 'drawer_id'],
    'checker_id'    => ['type' => 'integer', 'after' => 'drawer_name'],
    'checker_name'  => ['type' => 'string',  'after' => 'checker_id'],
    'qa_id'         => ['type' => 'integer', 'after' => 'checker_name'],
    'qa_name'       => ['type' => 'string',  'after' => 'qa_id'],
    'dassign_time'  => ['type' => 'string',  'after' => 'qa_name'],
    'cassign_time'  => ['type' => 'string',  'after' => 'dassign_time'],
    'drawer_done'   => ['type' => 'string',  'after' => 'cassign_time',  'length' => 10],
    'drawer_date'   => ['type' => 'string',  'after' => 'drawer_done'],
    'checker_done'  => ['type' => 'string',  'after' => 'drawer_date',   'length' => 10],
    'checker_date'  => ['type' => 'string',  'after' => 'checker_done'],
    'final_upload'  => ['type' => 'string',  'after' => 'checker_date',  'length' => 10],
    'ausFinaldate'  => ['type' => 'string',  'after' => 'final_upload'],
    'mistake'       => ['type' => 'text',    'after' => 'ausFinaldate'],
    'cmistake'      => ['type' => 'text',    'after' => 'mistake'],
    'd_id'          => ['type' => 'integer', 'after' => 'cmistake'],
    'amend'         => ['type' => 'string',  'after' => 'd_id',          'length' => 10],
    'd_live_qa'     => ['type' => 'integer', 'after' => 'amend'],
    'c_live_qa'     => ['type' => 'integer', 'after' => 'd_live_qa'],
    'qa_live_qa'    => ['type' => 'integer', 'after' => 'c_live_qa'],
];

for ($i = 1; $i <= 26; $i++) {
    $table = "project_{$i}_orders";

    if (!Schema::hasTable($table)) {
        echo "SKIP: {$table} does not exist\n";
        continue;
    }

    if (Schema::hasColumn($table, 'drawer_name')) {
        echo "SKIP: {$table} already has columns\n";
        continue;
    }

    Schema::table($table, function (Blueprint $t) use ($columns, $table) {
        foreach ($columns as $col => $cfg) {
            $length = $cfg['length'] ?? 255;
            if ($cfg['type'] === 'string') {
                $c = $t->string($col, $length);
            } elseif ($cfg['type'] === 'integer') {
                $c = $t->integer($col);
            } elseif ($cfg['type'] === 'text') {
                $c = $t->text($col);
            }
            $c->nullable();
            if (isset($cfg['after'])) $c->after($cfg['after']);
        }
    });

    echo "DONE: {$table} — 21 columns added\n";
}

echo "\nAll project tables updated!\n";
