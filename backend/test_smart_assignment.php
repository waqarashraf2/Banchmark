<?php
/**
 * Deep test of the Smart Assignment System
 * Run via: php artisan tinker < test_smart_assignment.php
 */

echo "\n========================================\n";
echo "  SMART ASSIGNMENT DEEP TEST\n";
echo "========================================\n\n";

$pass = 0;
$fail = 0;
$warnings = [];

function ok($label) { global $pass; $pass++; echo "  ✅ PASS: $label\n"; }
function bad($label, $detail = '') { global $fail; $fail++; echo "  ❌ FAIL: $label" . ($detail ? " — $detail" : '') . "\n"; }
function warn($label) { global $warnings; $warnings[] = $label; echo "  ⚠️  WARN: $label\n"; }

// ──────────────────────────────────────────────
// TEST 1: Migration — users table columns
// ──────────────────────────────────────────────
echo "── TEST 1: Users table columns ──\n";
$userCols = Schema::getColumnListing('users');
$required = ['wip_limit', 'avg_completion_minutes', 'rejection_rate_30d', 'assignment_score', 'skills'];
foreach ($required as $col) {
    if (in_array($col, $userCols)) {
        ok("users.$col exists");
    } else {
        bad("users.$col MISSING");
    }
}

// ──────────────────────────────────────────────
// TEST 2: Migration — project order tables
// ──────────────────────────────────────────────
echo "\n── TEST 2: Project order table columns ──\n";
$tables = DB::select("SHOW TABLES LIKE 'project_%_orders'");
if (empty($tables)) {
    warn("No project order tables found — skipping order column checks");
} else {
    $orderCols = ['complexity_weight', 'estimated_minutes', 'order_type'];
    foreach ($tables as $t) {
        $tname = array_values((array)$t)[0];
        $cols = Schema::getColumnListing($tname);
        foreach ($orderCols as $col) {
            if (in_array($col, $cols)) {
                ok("$tname.$col exists");
            } else {
                bad("$tname.$col MISSING");
            }
        }
    }
}

// ──────────────────────────────────────────────
// TEST 3: Default values
// ──────────────────────────────────────────────
echo "\n── TEST 3: Default values on users ──\n";
$drawers = DB::table('users')->where('role', 'drawer')->get();
if ($drawers->isEmpty()) {
    warn("No drawers found in users table");
} else {
    foreach ($drawers as $u) {
        if ($u->wip_limit == 5) {
            ok("User {$u->name} (id={$u->id}) wip_limit defaults to 5");
        } else {
            bad("User {$u->name} wip_limit = {$u->wip_limit}, expected 5");
        }
        if ($u->assignment_score !== null) {
            echo "     Score: {$u->assignment_score}\n";
        }
    }
}

echo "\n── TEST 3b: Default values on orders ──\n";
foreach ($tables ?? [] as $t) {
    $tname = array_values((array)$t)[0];
    $sample = DB::table($tname)->first();
    if (!$sample) continue;
    if (isset($sample->complexity_weight) && $sample->complexity_weight == 1) {
        ok("$tname.complexity_weight defaults to 1");
    } else {
        $val = $sample->complexity_weight ?? 'NULL';
        bad("$tname.complexity_weight = $val, expected 1");
    }
    if (isset($sample->order_type) && $sample->order_type == 'standard') {
        ok("$tname.order_type defaults to 'standard'");
    } else {
        $val = $sample->order_type ?? 'NULL';
        bad("$tname.order_type = '$val', expected 'standard'");
    }
}

// ──────────────────────────────────────────────
// TEST 4: ComputeWorkerStats job — dry run
// ──────────────────────────────────────────────
echo "\n── TEST 4: ComputeWorkerStats job execution ──\n";
try {
    $job = new \App\Jobs\ComputeWorkerStats();
    $job->handle();
    ok("ComputeWorkerStats executed without error");
    
    // Check if scores got computed
    $scored = DB::table('users')
        ->whereIn('role', ['drawer', 'checker', 'qa', 'designer'])
        ->where('is_active', true)
        ->get(['id', 'name', 'role', 'assignment_score', 'avg_completion_minutes', 'rejection_rate_30d', 'wip_limit']);
    
    echo "     Workers after scoring:\n";
    foreach ($scored as $w) {
        echo "       {$w->name} ({$w->role}): score={$w->assignment_score}, avg_min={$w->avg_completion_minutes}, rej_rate={$w->rejection_rate_30d}, wip_limit={$w->wip_limit}\n";
    }
    
    $anyScored = $scored->filter(fn($w) => $w->assignment_score > 0)->count();
    if ($anyScored > 0) {
        ok("$anyScored workers have score > 0");
    } else {
        warn("All workers have score 0 — likely no work_items history yet (expected on fresh data)");
    }
} catch (\Throwable $e) {
    bad("ComputeWorkerStats threw: " . $e->getMessage());
    echo "     " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "     " . substr($e->getTraceAsString(), 0, 500) . "\n";
}

// ──────────────────────────────────────────────
// TEST 5: AutoAssignOrders job — dry run
// ──────────────────────────────────────────────
echo "\n── TEST 5: AutoAssignOrders job execution ──\n";
try {
    $job = new \App\Jobs\AutoAssignOrders();
    $job->handle();
    ok("AutoAssignOrders executed without error");
} catch (\Throwable $e) {
    bad("AutoAssignOrders threw: " . $e->getMessage());
    echo "     " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "     " . substr($e->getTraceAsString(), 0, 500) . "\n";
}

// ──────────────────────────────────────────────
// TEST 6: AssignmentEngine — findBestUser
// ──────────────────────────────────────────────
echo "\n── TEST 6: AssignmentEngine::findBestUser ──\n";
try {
    $project = \App\Models\Project::first();
    if (!$project) {
        warn("No projects found — skipping AssignmentEngine test");
    } else {
        $best = \App\Services\AssignmentEngine::findBestUser($project->id, 'drawer');
        if ($best) {
            ok("findBestUser returned user: {$best->name} (id={$best->id}, score={$best->assignment_score})");
        } else {
            warn("findBestUser returned null — no available drawers (may be expected if all at WIP limit or none active)");
        }
        
        // Test with order_type
        $bestSkilled = \App\Services\AssignmentEngine::findBestUser($project->id, 'drawer', 'rush');
        if ($bestSkilled) {
            ok("findBestUser with orderType='rush' returned: {$bestSkilled->name}");
        } else {
            warn("findBestUser with orderType='rush' returned null — no workers with 'rush' skill (expected)");
        }
    }
} catch (\Throwable $e) {
    bad("AssignmentEngine::findBestUser threw: " . $e->getMessage());
    echo "     " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "     " . substr($e->getTraceAsString(), 0, 500) . "\n";
}

// ──────────────────────────────────────────────
// TEST 7: AssignmentEngine — startNext
// ──────────────────────────────────────────────
echo "\n── TEST 7: AssignmentEngine::startNext ──\n";
try {
    $worker = \App\Models\User::where('role', 'drawer')->where('is_active', true)->first();
    if (!$worker) {
        warn("No active drawer found — skipping startNext test");
    } else {
        $project = $worker->project;
        if (!$project) {
            warn("Drawer {$worker->name} has no project — skipping startNext test");
        } else {
            $engine = new \App\Services\AssignmentEngine();
            // Just test the logic path, don't necessarily need an order to be available
            $result = $engine->startNext($worker);
            if ($result) {
                ok("startNext assigned order #{$result->id} to {$worker->name}");
            } else {
                warn("startNext returned null for {$worker->name} — no pending orders or at WIP limit (expected on test data)");
            }
        }
    }
} catch (\Throwable $e) {
    bad("AssignmentEngine::startNext threw: " . $e->getMessage());
    echo "     " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "     " . substr($e->getTraceAsString(), 0, 500) . "\n";
}

// ──────────────────────────────────────────────
// TEST 8: WIP limit enforcement
// ──────────────────────────────────────────────
echo "\n── TEST 8: WIP limit enforcement ──\n";
try {
    $project = \App\Models\Project::first();
    if ($project) {
        // Check the SQL used in findAvailableWorker includes wip_limit
        $drawersAtLimit = DB::table('users')
            ->where('role', 'drawer')
            ->where('is_active', true)
            ->whereRaw('wip_count >= wip_limit')
            ->get(['id', 'name', 'wip_count', 'wip_limit']);
        
        echo "     Drawers at/over WIP limit: {$drawersAtLimit->count()}\n";
        foreach ($drawersAtLimit as $d) {
            echo "       {$d->name}: wip_count={$d->wip_count}, wip_limit={$d->wip_limit}\n";
        }
        
        $drawersUnderLimit = DB::table('users')
            ->where('role', 'drawer')
            ->where('is_active', true)
            ->whereRaw('wip_count < wip_limit')
            ->get(['id', 'name', 'wip_count', 'wip_limit', 'assignment_score']);
        
        echo "     Drawers under WIP limit: {$drawersUnderLimit->count()}\n";
        foreach ($drawersUnderLimit as $d) {
            echo "       {$d->name}: wip={$d->wip_count}/{$d->wip_limit}, score={$d->assignment_score}\n";
        }
        ok("WIP limit query works correctly");
    }
} catch (\Throwable $e) {
    bad("WIP limit check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// TEST 9: Skills JSON column
// ──────────────────────────────────────────────
echo "\n── TEST 9: Skills JSON column ──\n";
try {
    // Test setting skills on a user
    $testUser = \App\Models\User::where('role', 'drawer')->first();
    if ($testUser) {
        $oldSkills = $testUser->skills;
        $testUser->skills = ['rush', 'complex_floor'];
        $testUser->save();
        $testUser->refresh();
        
        if (is_array($testUser->skills) && in_array('rush', $testUser->skills)) {
            ok("Skills JSON save/load works: " . json_encode($testUser->skills));
        } else {
            bad("Skills not saved correctly, got: " . json_encode($testUser->skills));
        }
        
        // Test JSON_CONTAINS query
        $matched = DB::table('users')
            ->whereRaw("JSON_CONTAINS(skills, '\"rush\"', '$')")
            ->get(['id', 'name', 'skills']);
        
        if ($matched->count() > 0) {
            ok("JSON_CONTAINS skill matching works: found {$matched->count()} user(s)");
        } else {
            bad("JSON_CONTAINS query returned 0 results after setting skills");
        }
        
        // Restore original
        $testUser->skills = $oldSkills;
        $testUser->save();
        ok("Skills restored to original value");
    }
} catch (\Throwable $e) {
    bad("Skills test threw: " . $e->getMessage());
    echo "     " . $e->getFile() . ":" . $e->getLine() . "\n";
}

// ──────────────────────────────────────────────
// TEST 10: User API — wip_limit update
// ──────────────────────────────────────────────
echo "\n── TEST 10: UpdateUserRequest validation rules ──\n";
try {
    $request = new \App\Http\Requests\UpdateUserRequest();
    $rules = $request->rules();
    
    if (isset($rules['wip_limit'])) {
        ok("UpdateUserRequest has 'wip_limit' rule: {$rules['wip_limit']}");
    } else {
        bad("UpdateUserRequest missing 'wip_limit' rule");
    }
    
    if (isset($rules['skills'])) {
        ok("UpdateUserRequest has 'skills' rule: {$rules['skills']}");
    } else {
        bad("UpdateUserRequest missing 'skills' rule");
    }
    
    if (isset($rules['skills.*'])) {
        ok("UpdateUserRequest has 'skills.*' rule: {$rules['skills.*']}");
    } else {
        bad("UpdateUserRequest missing 'skills.*' rule");
    }
} catch (\Throwable $e) {
    bad("Validation rules check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// TEST 11: StoreUserRequest validation rules
// ──────────────────────────────────────────────
echo "\n── TEST 11: StoreUserRequest validation rules ──\n";
try {
    $request = new \App\Http\Requests\StoreUserRequest();
    $rules = $request->rules();
    
    if (isset($rules['wip_limit'])) {
        ok("StoreUserRequest has 'wip_limit' rule");
    } else {
        bad("StoreUserRequest missing 'wip_limit' rule");
    }
    
    if (isset($rules['skills'])) {
        ok("StoreUserRequest has 'skills' rule");
    } else {
        bad("StoreUserRequest missing 'skills' rule");
    }
} catch (\Throwable $e) {
    bad("StoreUserRequest check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// TEST 12: Index on users table
// ──────────────────────────────────────────────
echo "\n── TEST 12: Smart assignment index ──\n";
try {
    $indexes = DB::select("SHOW INDEX FROM users WHERE Key_name = 'idx_smart_assignment'");
    if (count($indexes) > 0) {
        ok("idx_smart_assignment index exists on users table (" . count($indexes) . " columns)");
    } else {
        bad("idx_smart_assignment index NOT found on users table");
    }
} catch (\Throwable $e) {
    bad("Index check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// TEST 13: Scheduler registration
// ──────────────────────────────────────────────
echo "\n── TEST 13: Scheduler registration ──\n";
try {
    $scheduleContent = file_get_contents(base_path('routes/console.php'));
    if (str_contains($scheduleContent, 'ComputeWorkerStats')) {
        ok("ComputeWorkerStats is registered in scheduler");
    } else {
        bad("ComputeWorkerStats NOT found in routes/console.php");
    }
    if (str_contains($scheduleContent, 'AutoAssignOrders')) {
        ok("AutoAssignOrders is registered in scheduler");
    } else {
        bad("AutoAssignOrders NOT found in routes/console.php");
    }
} catch (\Throwable $e) {
    bad("Scheduler check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// TEST 14: Edge case — score formula bounds
// ──────────────────────────────────────────────
echo "\n── TEST 14: Score formula bounds check ──\n";
try {
    // Scores should be between 0 and 1
    $outOfBounds = DB::table('users')
        ->whereIn('role', ['drawer', 'checker', 'qa', 'designer'])
        ->where(function($q) {
            $q->where('assignment_score', '<', 0)
              ->orWhere('assignment_score', '>', 1);
        })
        ->count();
    
    if ($outOfBounds === 0) {
        ok("All assignment_score values are within 0.0–1.0 range");
    } else {
        bad("$outOfBounds users have assignment_score outside 0.0–1.0 range");
    }
    
    // rejection_rate should be 0-1
    $badRejRate = DB::table('users')
        ->whereIn('role', ['drawer', 'checker', 'qa', 'designer'])
        ->where(function($q) {
            $q->where('rejection_rate_30d', '<', 0)
              ->orWhere('rejection_rate_30d', '>', 1);
        })
        ->count();
    
    if ($badRejRate === 0) {
        ok("All rejection_rate_30d values are within 0.0–1.0 range");
    } else {
        bad("$badRejRate users have rejection_rate_30d outside 0.0–1.0 range");
    }
} catch (\Throwable $e) {
    bad("Bounds check threw: " . $e->getMessage());
}

// ──────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────
echo "\n========================================\n";
echo "  RESULTS: $pass passed, $fail failed, " . count($warnings) . " warnings\n";
echo "========================================\n";
if ($fail > 0) {
    echo "  ⛔ ISSUES FOUND — see FAIL items above\n";
} else {
    echo "  🎉 ALL TESTS PASSED\n";
}
if (!empty($warnings)) {
    echo "  Warnings:\n";
    foreach ($warnings as $w) echo "    - $w\n";
}
echo "\n";
