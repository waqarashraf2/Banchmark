<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use DateTime;
use DateTimeZone;
use Exception;

class SaFPImportService
{
    protected string $apiUrl = 'https://diary-booking-assistant-4f2ee1a4.base44.app/api/functions/processorTasksJson?api_key=PzpZrmL5vmAnEpNpWx5LBQJMRHqodPyR&processor_id=6284';
    protected string $apiKey = 'YOUR_API_KEY';
    protected int $processorId = 11441;
    protected int $projectId = 12;
    protected string $table = 'project_12_orders';

    protected function mapStatus(string $status): string
    {
        return match($status) {
            'processing' => 'in-progress',
            'completed' => 'completed',
            default => 'pending',
        };
    }

    public function run()
    {
        try {

            $response = Http::timeout(60)->get($this->apiUrl);

            if (!$response->successful()) {
                Log::error('Project12 API failed');
                return;
            }

            $data = $response->json();

            if (!isset($data['tasks'])) {
                Log::warning('No tasks found in API');
                return;
            }

            $records = [];
            $inserted = 0;
            $skipped = 0;
            $instructionMaxLength = $this->getInstructionMaxLength();

            $nowPK = new DateTime('now', new DateTimeZone('Asia/Karachi'));

            foreach ($data['tasks'] as $task) {

                // ONLY FLOORPLAN - only process tasks with product_category_id = 2 and product_id = 3
                if (!isset($task['product_category_id']) || $task['product_category_id'] != 2 || !isset($task['product_id']) || $task['product_id'] != 3) {
                    continue;
                }

                if (empty($task['order_id']) || empty($task['id'])) {
                    continue;
                }

                // TIME RULES - Use conduct_date as received_at
                $conductDate = isset($task['conduct_date']) ? new DateTime($task['conduct_date']) : new DateTime('now', new DateTimeZone('Asia/Karachi'));
                $receivedAt = $conductDate;
                $dueIn = (clone $receivedAt)->modify('+6 hours');

                $clerkArea = $task['clerk_area'] ?? null;
                $processorNotes = isset($task['processor_notes']) ? trim((string) $task['processor_notes']) : null;
                $processorNotes = $processorNotes === '' ? null : $processorNotes;
                $safeInstruction = $this->normalizeInstructionForInsert($processorNotes, $instructionMaxLength);

                $records[] = [

                    // IDs
                    'order_number' => $task['order_id'],
                    'client_portal_id' => $task['id'],
                    'project_id' => $this->projectId,

                    // CLIENT
                    'client_name' => $task['client'] ?? null,
                    'branch' => $task['branch'] ?? null,

                    // AREA (same stored in both fields)
                    'clerk_area' => $clerkArea,
                    'address' => $clerkArea,

                    // PROCESSOR
                    'processor_id' => $task['processor_id'] ?? null,
                    'processor_name' => $task['processor_name'] ?? null,

                    // TASK
                    'plan_type' => $task['name'] ?? null,
                    'instruction' => $safeInstruction,
                    'current_layer' => 'drawer',

                    // ❌ IMPORTANT FIX
                    // DO NOT USE amend from API
                    // Keep NULL always OR remove field if nullable
                    'amend' => null,

                    // TIME
                    'received_at' => $receivedAt->format('Y-m-d H:i:s'),
                    'due_in' => $dueIn->format('Y-m-d H:i:s'),

                    'started_at' => null,

                    // ATTACHMENTS
                    'attachments' => json_encode([
                        'wms_url' => $task['wms_url'] ?? null
                    ]),

                    // STORE FULL RAW API SAFE
                    'metadata' => json_encode($task),

                    // SYSTEM
                    'import_source' => 'cron',

                    'year' => $nowPK->format('Y'),
                    'month' => $nowPK->format('m'),
                    'date' => $nowPK->format('d-m-Y'),

                    'created_at' => $nowPK->format('Y-m-d H:i:s'),
                    'updated_at' => $nowPK->format('Y-m-d H:i:s'),
                ];
            }

            if (!empty($records)) {
                foreach ($records as $record) {
                    try {
                        $result = DB::table($this->table)->insertOrIgnore([$record]);
                        if ($result === 1) {
                            $inserted++;
                        } else {
                            $skipped++;
                        }
                    } catch (Exception $rowException) {
                        $skipped++;
                        Log::warning('Project12 Import Row Skipped', [
                            'order_number' => $record['order_number'] ?? null,
                            'client_portal_id' => $record['client_portal_id'] ?? null,
                            'message' => $rowException->getMessage(),
                        ]);
                    }
                }

                Log::info('Project12 Import Completed', [
                    'fetched' => count($records),
                    'inserted' => $inserted,
                    'skipped' => $skipped,
                    'instruction_max_length' => $instructionMaxLength,
                ]);

            } else {
                Log::warning('Project12 Import: No valid records found');
            }

        } catch (Exception $e) {
            Log::error('Project12 Import Error: '.$e->getMessage());
        }
    }

    private function getInstructionMaxLength(): ?int
    {
        $column = collect(DB::select("SHOW COLUMNS FROM {$this->table} LIKE 'instruction'"))->first();
        $type = strtolower((string) ($column->Type ?? ''));

        if (preg_match('/varchar\((\d+)\)/', $type, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    private function normalizeInstructionForInsert(?string $instruction, ?int $maxLength): ?string
    {
        if ($instruction === null || $instruction === '') {
            return null;
        }

        if ($maxLength === null) {
            return $instruction;
        }

        return Str::limit($instruction, $maxLength, '');
    }
}
