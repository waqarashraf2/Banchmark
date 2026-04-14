<?php
// Run with: php add_missing_columns.php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

$table = 'project_13_orders';

// ── Step 1: Show what's missing ────────────────────────────────────
echo "=== OLD SYSTEM COLUMNS ===" . PHP_EOL;
$oldCols = DB::select("SHOW COLUMNS FROM stellarinstitute_metro_old.`order`");
$oldNames = array_map(fn($c) => $c->Field, $oldCols);
foreach ($oldCols as $c) echo "  {$c->Field} ({$c->Type})" . PHP_EOL;

echo PHP_EOL . "=== NEW SYSTEM COLUMNS ===" . PHP_EOL;
$newCols = DB::select("SHOW COLUMNS FROM {$table}");
$newNames = array_map(fn($c) => $c->Field, $newCols);

echo PHP_EOL . "=== MISSING IN NEW ===" . PHP_EOL;
foreach ($oldNames as $o) {
    if (!in_array($o, $newNames)) {
        echo "  MISSING: {$o}" . PHP_EOL;
    }
}

// ── Step 2: Add missing worker tracking columns ───────────────────
echo PHP_EOL . "=== ADDING MISSING COLUMNS ===" . PHP_EOL;

$columnsToAdd = [
    // Worker names & IDs per layer
    'drawer_id'     => ['type' => 'integer', 'nullable' => true, 'after' => 'assigned_to'],
    'drawer_name'   => ['type' => 'string',  'nullable' => true, 'after' => 'drawer_id'],
    'checker_id'    => ['type' => 'integer', 'nullable' => true, 'after' => 'drawer_name'],
    'checker_name'  => ['type' => 'string',  'nullable' => true, 'after' => 'checker_id'],
    'qa_id'         => ['type' => 'integer', 'nullable' => true, 'after' => 'checker_name'],
    'qa_name'       => ['type' => 'string',  'nullable' => true, 'after' => 'qa_id'],
    // Assignment & completion timestamps per layer
    'dassign_time'  => ['type' => 'string',  'nullable' => true, 'after' => 'qa_name'],
    'cassign_time'  => ['type' => 'string',  'nullable' => true, 'after' => 'dassign_time'],
    'drawer_done'   => ['type' => 'string',  'nullable' => true, 'after' => 'cassign_time', 'length' => 10],
    'drawer_date'   => ['type' => 'string',  'nullable' => true, 'after' => 'drawer_done'],
    'checker_done'  => ['type' => 'string',  'nullable' => true, 'after' => 'drawer_date', 'length' => 10],
    'checker_date'  => ['type' => 'string',  'nullable' => true, 'after' => 'checker_done'],
    'final_upload'  => ['type' => 'string',  'nullable' => true, 'after' => 'checker_date', 'length' => 10],
    'ausFinaldate'  => ['type' => 'string',  'nullable' => true, 'after' => 'final_upload'],
    // Mistake/error tracking
    'mistake'       => ['type' => 'text',    'nullable' => true, 'after' => 'ausFinaldate'],
    'cmistake'      => ['type' => 'text',    'nullable' => true, 'after' => 'mistake'],
    // Old system references
    'd_id'          => ['type' => 'integer', 'nullable' => true, 'after' => 'cmistake'],
    'amend'         => ['type' => 'string',  'nullable' => true, 'after' => 'd_id', 'length' => 10],
    'd_live_qa'     => ['type' => 'integer', 'nullable' => true, 'after' => 'amend'],
    'c_live_qa'     => ['type' => 'integer', 'nullable' => true, 'after' => 'd_live_qa'],
    'qa_live_qa'    => ['type' => 'integer', 'nullable' => true, 'after' => 'c_live_qa'],
];

Schema::table($table, function (Blueprint $t) use ($columnsToAdd) {
    foreach ($columnsToAdd as $col => $config) {
        if (Schema::hasColumn('project_13_orders', $col)) {
            echo "  SKIP (exists): {$col}" . PHP_EOL;
            continue;
        }

        $length = $config['length'] ?? 255;  
        if ($config['type'] === 'string') {
            $c = $t->string($col, $length);
        } elseif ($config['type'] === 'integer') {
            $c = $t->integer($col);
        } elseif ($config['type'] === 'text') {
            $c = $t->text($col);
        }

        if ($config['nullable']) $c->nullable();
        if (isset($config['after'])) $c->after($config['after']);

        echo "  ADDED: {$col}" . PHP_EOL;
    }
});

// ── Step 3: Populate from metadata + old DB ───────────────────────
echo PHP_EOL . "=== POPULATING WORKER DATA FROM OLD DB ===" . PHP_EOL;

// Populate drawer_name, checker_name, qa_name, and all old fields from the old order table
$batchSize = 1000;
$offset = 0;
$updated = 0;

while (true) {
    $orders = DB::table($table)
        ->whereNull('drawer_name')
        ->where('import_source', 'csv')
        ->orderBy('id')
        ->limit($batchSize)
        ->get(['id', 'metadata']);

    if ($orders->isEmpty()) break;

    foreach ($orders as $order) {
        $meta = json_decode($order->metadata, true);
        if (!$meta || !isset($meta['_old_id'])) continue;

        $oldId = $meta['_old_id'];

        // Fetch from old DB
        $oldOrder = DB::selectOne(
            "SELECT dname, cname, qa_person, dassign_time, cassign_time, drawer_done, drawer_date, checker_done, checker_date, final_upload, ausFinaldate, mistake, cmistake, d_id, amend, d_live_qa, c_live_qa, qa_live_qa FROM stellarinstitute_metro_old.`order` WHERE id = ?",
            [$oldId]
        );

        if (!$oldOrder) continue;

        // Resolve new system IDs for workers
        $drawerId = null;
        $checkerId = null;
        $qaId = null;

        if ($oldOrder->dname) {
            $dUser = DB::table('users')
                ->where('name', trim($oldOrder->dname))
                ->where('role', 'drawer')
                ->where('email', 'like', '%@benchmark-metro.internal')
                ->first(['id']);
            $drawerId = $dUser ? $dUser->id : null;
        }

        if ($oldOrder->cname) {
            $cUser = DB::table('users')
                ->where('name', trim($oldOrder->cname))
                ->where('role', 'checker')
                ->where('email', 'like', '%@benchmark-metro.internal')
                ->first(['id']);
            $checkerId = $cUser ? $cUser->id : null;
        }

        if ($oldOrder->qa_person) {
            $qUser = DB::table('users')
                ->where('name', trim($oldOrder->qa_person))
                ->where('role', 'qa')
                ->where('email', 'like', '%@benchmark-metro.internal')
                ->first(['id']);
            $qaId = $qUser ? $qUser->id : null;
        }

        DB::table($table)->where('id', $order->id)->update([
            'drawer_id'    => $drawerId,
            'drawer_name'  => $oldOrder->dname ? trim($oldOrder->dname) : null,
            'checker_id'   => $checkerId,
            'checker_name' => $oldOrder->cname ? trim($oldOrder->cname) : null,
            'qa_id'        => $qaId,
            'qa_name'      => $oldOrder->qa_person ? trim($oldOrder->qa_person) : null,
            'dassign_time' => $oldOrder->dassign_time,
            'cassign_time' => $oldOrder->cassign_time,
            'drawer_done'  => $oldOrder->drawer_done,
            'drawer_date'  => $oldOrder->drawer_date,
            'checker_done' => $oldOrder->checker_done,
            'checker_date' => $oldOrder->checker_date,
            'final_upload' => $oldOrder->final_upload,
            'ausFinaldate' => $oldOrder->ausFinaldate,
            'mistake'      => $oldOrder->mistake,
            'cmistake'     => $oldOrder->cmistake,
            'd_id'         => $oldOrder->d_id,
            'amend'        => $oldOrder->amend,
            'd_live_qa'    => $oldOrder->d_live_qa,
            'c_live_qa'    => $oldOrder->c_live_qa,
            'qa_live_qa'   => $oldOrder->qa_live_qa,
        ]);

        $updated++;
    }

    echo "  Updated {$updated} orders so far..." . PHP_EOL;
    $offset += $batchSize;
}

echo PHP_EOL . "=== DONE ===" . PHP_EOL;
echo "Total orders updated with worker names/IDs: {$updated}" . PHP_EOL;

// Verify
$sample = DB::table($table)->whereNotNull('drawer_name')->limit(5)->get(['id', 'order_number', 'drawer_id', 'drawer_name', 'checker_id', 'checker_name', 'qa_id', 'qa_name', 'drawer_done', 'checker_done', 'final_upload']);
echo PHP_EOL . "=== SAMPLE ORDERS ===" . PHP_EOL;
foreach ($sample as $s) {
    echo "  {$s->order_number} | drawer: {$s->drawer_name} (id={$s->drawer_id}) | checker: {$s->checker_name} (id={$s->checker_id}) | qa: {$s->qa_name} (id={$s->qa_id}) | d_done={$s->drawer_done} c_done={$s->checker_done} final={$s->final_upload}" . PHP_EOL;
}

$withDrawer = DB::table($table)->whereNotNull('drawer_name')->where('drawer_name', '!=', '')->count();
$withDrawerId = DB::table($table)->whereNotNull('drawer_id')->count();
$withChecker = DB::table($table)->whereNotNull('checker_name')->where('checker_name', '!=', '')->count();
$withCheckerId = DB::table($table)->whereNotNull('checker_id')->count();
$withQa = DB::table($table)->whereNotNull('qa_name')->where('qa_name', '!=', '')->count();
$withQaId = DB::table($table)->whereNotNull('qa_id')->count();

echo PHP_EOL . "=== STATS ===" . PHP_EOL;
echo "Orders with drawer_name: {$withDrawer} (with ID resolved: {$withDrawerId})" . PHP_EOL;
echo "Orders with checker_name: {$withChecker} (with ID resolved: {$withCheckerId})" . PHP_EOL;
echo "Orders with qa_name: {$withQa} (with ID resolved: {$withQaId})" . PHP_EOL;
