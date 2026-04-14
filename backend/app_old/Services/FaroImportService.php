<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use DOMDocument;
use DOMXPath;
use DateTime;
use DateTimeZone;
use Exception;

class FaroImportService
{
    protected int $maxPages = 10;

    // ✅ FARO CONFIG
    protected string $url = 'https://es-portal.captur3d.io/external_supplier/universal_floorplan_orders?filter=pending';
    protected string $username = 'order@benchmarkstudio.biz';
    protected string $password = 'OgLilaA@yqE1&Rfc';
    protected int $projectId = 27; // ⚠️ change if your Faro project ID is different
    protected string $table = 'project_7_orders'; // ⚠️ change if needed

    public function fetchVariantNo(string $orderId, array $auth): ?string
    {
        $cleanId = ltrim($orderId, '#');

        $url = "https://es-portal.captur3d.io/external_supplier/orders/{$cleanId}.json";

        $res = $this->curlRequest($url, 'GET', $auth);

        if ($res['error'] || $res['code'] !== 200) {
            Log::warning("Variant fetch failed for order {$orderId}, HTTP code: {$res['code']}");
            return null;
        }

        $data = json_decode($res['body'], true);

        if (!$data || !isset($data['data']['orderable']['variantName'])) {
            Log::warning("Variant not found in JSON for order {$orderId}");
            return null;
        }

        return $data['data']['orderable']['variantName'];
    }

    protected function curlRequest(string $url, string $method = 'GET', ?array $auth = null): array
    {
        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT      => 'BenchmarkCron/1.0',
        ]);

        if ($auth) {
            curl_setopt($ch, CURLOPT_USERPWD, $auth[0] . ':' . $auth[1]);
        }

        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = $response === false ? curl_error($ch) : null;

        curl_close($ch);

        return [
            'code' => $code,
            'body' => $response ?: '',
            'error' => $err
        ];
    }

    protected function parseDueIn(string $dueRaw): string
    {
        $dt = new DateTime('now', new DateTimeZone('Asia/Karachi'));
        $raw = strtolower(trim($dueRaw));

        preg_match('/(\d+)/', $raw, $match);
        $value = isset($match[1]) ? (int)$match[1] : 0;

        if ($value <= 0) {
            return $dt->format('Y-m-d H:i:s');
        }

        if (str_contains($raw, 'day')) {
            $dt->modify("+{$value} days");
        } elseif (str_contains($raw, 'hour')) {
            $dt->modify("+{$value} hours");
        } elseif (str_contains($raw, 'minute')) {
            $dt->modify("+{$value} minutes");
        } else {
            $dt->modify("+{$value} hours");
        }

        return $dt->format('Y-m-d H:i:s');
    }

    public function run()
    {
        $page = 1;
        $username = $this->username;
        $password = $this->password;
        $projectId = $this->projectId;
        $table = $this->table;
        $url = $this->url;

        $totalInserted = 0;

        while ($page <= $this->maxPages) {

            try {
                $pageUrl = $url . (str_contains($url, '?') ? '&' : '?') . 'page=' . $page;

                $response = Http::timeout(60)
                    ->withHeaders([
                        'User-Agent' => 'BenchmarkCron/1.0',
                        'Accept' => 'text/html'
                    ])
                    ->withBasicAuth($username, $password)
                    ->get($pageUrl);

                if (!$response->successful()) break;

                libxml_use_internal_errors(true);
                $dom = new DOMDocument();
                $dom->loadHTML('<?xml encoding="UTF-8">'.$response->body());
                $xpath = new DOMXPath($dom);

                $rows = $xpath->query('//table//tr');

                if ($rows->length < 2) {
                    Log::warning("No table rows found on page {$page}");
                    $page++;
                    continue;
                }

                $headers = [];
                foreach ($rows->item(0)->getElementsByTagName('th') as $th) {
                    $headers[] = trim($th->textContent);
                }

                $records = [];

                for ($i=1; $i<$rows->length; $i++) {

                    $cells = $rows->item($i)->getElementsByTagName('td');
                    if ($cells->length === 0) continue;

                    $row = [];
                    foreach ($cells as $idx => $cell) {
                        if (isset($headers[$idx])) {
                            $row[$headers[$idx]] = trim($cell->textContent);
                        }
                    }

                    $rawOrderId = $row['Order ID'] ?? null;
                    if (!$rawOrderId) continue;

                    $address = $row['Address'] ?? '';
                    $priorityRaw = strtolower(trim($row['Priority'] ?? 'normal'));
                    $priority = in_array($priorityRaw, ['low','normal','high','urgent']) ? $priorityRaw : 'normal';

                    $receivedAt = new DateTime('now', new DateTimeZone('Asia/Karachi'));
                    $dueInRaw = trim($row['Due in'] ?? $row['Due In'] ?? '');
                    $dueIn = $this->parseDueIn($dueInRaw);

                    try {
                        $variantNo = $this->fetchVariantNo($rawOrderId, [$username, $password]);
                    } catch (\Exception $e) {
                        Log::warning("Failed to fetch variant for order {$rawOrderId}: ".$e->getMessage());
                        $variantNo = null;
                    }

                    $nowPK = new DateTime('now', new DateTimeZone('Asia/Karachi'));

                    $records[] = [
                        'order_number' => $rawOrderId,
                        'client_reference' => $rawOrderId,
                        'project_id' => $projectId,
                        'address' => $address,
                        'priority' => $priority,
                        'current_layer' => 'drawer',
                        'status' => 'pending',
                        'workflow_state' => 'RECEIVED',
                        'workflow_type' => 'FP_3_LAYER',
                        'received_at' => $receivedAt->format('Y-m-d H:i:s'),
                        'due_in' => $dueIn,
                        'variant_no' => $variantNo,
                        'metadata' => json_encode([
                            'due_in_raw' => $dueInRaw,
                            'variant_fetch_method' => $variantNo ? 'detail_page' : 'not_found'
                        ]),
                        'import_source' => 'cron',
                        'year' => $nowPK->format('Y'),
                        'month' => $nowPK->format('m'),
                        'date' => $nowPK->format('d-m-Y'),
                        'created_at' => $nowPK->format('Y-m-d H:i:s'),
                        'updated_at' => $nowPK->format('Y-m-d H:i:s')
                    ];
                }

                if (!empty($records)) {
                    Log::info("Inserting ".count($records)." records on page {$page}");
                    DB::table($table)->upsert(
                        $records,
                        ['order_number'],
                        ['updated_at','variant_no','due_in','metadata']
                    );
                    $totalInserted += count($records);
                }

                $page++;
                usleep(300000);

            } catch (Exception $e) {
                Log::error("Import error page {$page}: ".$e->getMessage());
                $page++;
            }
        }

        Log::info("Import finished, total inserted: {$totalInserted}");
    }
}