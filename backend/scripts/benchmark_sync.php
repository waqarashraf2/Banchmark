<?php
/**
 * ============================================================
 *  METRO → BENCHMARK SYNC WEBHOOK
 * ============================================================
 *
 *  This file should be placed on the OLD Metro system's server.
 *  It sends order data to the NEW Benchmark system whenever
 *  an order action happens (assign, done, upload, etc.).
 *
 *  USAGE:
 *  ------
 *  Include this file in the old system's order action handlers,
 *  then call syncToNewSystem($orderData) after each action.
 *
 *  EXAMPLE (in old system's assign_drawer.php):
 *  ─────────────────────────────────────────────
 *    require_once 'benchmark_sync.php';
 *
 *    // After assigning drawer in old system...
 *    syncToNewSystem([
 *        'old_id'      => $order_id,      // Primary key from old `data` table
 *        'order_id'    => $row['order_id'],
 *        'property'    => $row['property'],
 *        'client_name' => $row['client_name'],
 *        'dname'       => $drawer_name,
 *        'cname'       => $row['cname'],
 *        'status'      => $row['status'],
 *        'reason'      => $row['reason'],
 *        'dassign_time'=> date('Y-m-d H:i:s'),
 *        'drawer_done' => $row['drawer_done'],
 *        'checker_done'=> $row['checker_done'],
 *        'final_upload'=> $row['final_upload'],
 *        'code'        => $row['code'],
 *        'plan_type'   => $row['plan_type'],
 *        'instruction' => $row['instruction'],
 *    ]);
 *
 *  QUICK INTEGRATIONS:
 *  ───────────────────
 *  1. Manager assigns drawer    → call syncToNewSystem() with dname, dassign_time
 *  2. Manager assigns checker   → call syncToNewSystem() with cname, cassign_time
 *  3. Drawer marks done         → call syncToNewSystem() with drawer_done='yes', drawer_date
 *  4. Checker marks done        → call syncToNewSystem() with checker_done='yes', checker_date
 *  5. QA final upload           → call syncToNewSystem() with final_upload='yes', ausFinaldate
 *  6. Order rejected            → call syncToNewSystem() with status='pending', reason='...'
 *  7. New order added           → call syncToNewSystem() with full row from `data` table
 *
 *  NOTE: Always include 'old_id' (the id from old `data` table).
 *        Other fields are optional — only changed fields need to be sent.
 * ============================================================
 */

// ─── Configuration ──────────────────────────────────────────
define('BENCHMARK_SYNC_URL', 'https://new.stellarinstitute.pk/api/sync/order');
define('BENCHMARK_SYNC_TOKEN', 'BM_SYNC_2026_x9K4mP7qR2vL');
define('BENCHMARK_SYNC_TIMEOUT', 5); // seconds
define('BENCHMARK_SYNC_LOG', __DIR__ . '/benchmark_sync.log');

/**
 * Send order data to the new Benchmark system.
 *
 * @param array $orderData  Associative array of fields. 'old_id' is required.
 * @return bool True if sync was successful.
 */
function syncToNewSystem(array $orderData): bool
{
    if (empty($orderData['old_id'])) {
        logSync("ERROR: old_id is missing. Data: " . json_encode($orderData));
        return false;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => BENCHMARK_SYNC_URL,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($orderData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => BENCHMARK_SYNC_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Sync-Token: ' . BENCHMARK_SYNC_TOKEN,
            'User-Agent: MetroSyncWebhook/1.0',
        ],
        // SSL verification — set to true in production if cert is valid
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error) {
        logSync("CURL ERROR for old_id={$orderData['old_id']}: {$error}");
        return false;
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        $result = json_decode($response, true);
        $action = $result['action'] ?? 'unknown';
        logSync("OK: old_id={$orderData['old_id']} → {$action} (HTTP {$httpCode})");
        return true;
    } else {
        logSync("FAIL: old_id={$orderData['old_id']} HTTP {$httpCode} — {$response}");
        return false;
    }
}

/**
 * Send a full row from the old `data` table.
 * This is a convenience wrapper that sends ALL fields.
 *
 * @param array $row  Full row from SELECT * FROM `data` WHERE id = ?
 * @return bool
 */
function syncFullOrderRow(array $row): bool
{
    // Map old row's `id` to `old_id`
    $data = $row;
    if (isset($data['id']) && !isset($data['old_id'])) {
        $data['old_id'] = $data['id'];
    }
    return syncToNewSystem($data);
}

/**
 * Sync multiple orders at once (batch mode).
 * Use this for periodic cron sync of recently changed orders.
 *
 * @param array $orders  Array of order data arrays. Each must have 'old_id'.
 * @return array  ['success' => int, 'failed' => int]
 */
function syncBatchToNewSystem(array $orders): array
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => str_replace('/order', '/batch', BENCHMARK_SYNC_URL),
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['orders' => $orders]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Sync-Token: ' . BENCHMARK_SYNC_TOKEN,
            'User-Agent: MetroSyncWebhook/1.0',
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error || $httpCode >= 300) {
        logSync("BATCH FAIL: HTTP {$httpCode}, Error: {$error}, Response: {$response}");
        return ['success' => 0, 'failed' => count($orders)];
    }

    $result = json_decode($response, true);
    $inserted = $result['results']['inserted'] ?? 0;
    $updated  = $result['results']['updated'] ?? 0;
    $errors   = $result['results']['errors'] ?? 0;

    logSync("BATCH OK: inserted={$inserted}, updated={$updated}, errors={$errors}");

    return [
        'success' => $inserted + $updated,
        'failed'  => $errors,
    ];
}

/**
 * Write to sync log file.
 */
function logSync(string $message): void
{
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents(
        BENCHMARK_SYNC_LOG,
        "[{$timestamp}] {$message}\n",
        FILE_APPEND | LOCK_EX
    );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EXAMPLE: Cron-based periodic sync (run every 5 minutes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
//  Create a file called `cron_sync.php` in the old system:
//
//  <?php
//  require_once 'benchmark_sync.php';
//
//  // Connect to old Metro DB
//  $pdo = new PDO('mysql:host=localhost;dbname=sheetbenchmark_transdat_aus-metro', 'user', 'pass');
//
//  // Get orders modified in last 10 minutes
//  $stmt = $pdo->query("
//      SELECT * FROM `data`
//      WHERE modified_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
//         OR dassign_time >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
//         OR cassign_time >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
//         OR drawer_date  >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
//         OR checker_date >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
//  ");
//
//  $orders = [];
//  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
//      $row['old_id'] = $row['id'];
//      $orders[] = $row;
//  }
//
//  if (count($orders) > 0) {
//      $result = syncBatchToNewSystem($orders);
//      echo "Synced: {$result['success']} orders, Failed: {$result['failed']}\n";
//  } else {
//      echo "No changes to sync.\n";
//  }
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
