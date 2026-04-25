<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use DateTime;
use DateTimeZone;
use Exception;

class SaPhotoService
{
    protected string $apiUrl = 'https://diary-booking-assistant-4f2ee1a4.base44.app/api/functions/processorTasksJson?api_key=PzpZrmL5vmAnEpNpWx5LBQJMRHqodPyR&processor_id=6284';
    protected string $apiKey = 'YOUR_API_KEY';
    protected int $processorId = 6284;
    protected int $projectId = 19;
    protected string $table = 'project_19_orders';

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
                Log::error('Project19 Photo API failed');
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
            $existingClientPortalIds = $this->getExistingClientPortalIds($data['tasks']);
            $queuedClientPortalIds = [];

            foreach ($data['tasks'] as $task) {

                // ONLY PHOTO CATEGORY - process tasks from product_category_id = 3 only
                if (!isset($task['product_category_id']) || (int) $task['product_category_id'] !== 3) {
                    continue;
                }

                if (empty($task['order_id']) || empty($task['id'])) {
                    continue;
                }

                $clientPortalId = (string) $task['id'];

                // client_portal_id is the real unique key for this import.
                // Keep insert-only behavior so existing status/workflow fields are never updated.
                if (isset($existingClientPortalIds[$clientPortalId]) || isset($queuedClientPortalIds[$clientPortalId])) {
                    $skipped++;
                    continue;
                }

                $queuedClientPortalIds[$clientPortalId] = true;

                // TIME RULES
                // conduct_date -> received_at
                // processing_at -> created_at
                // These can be different or the same depending on the API data.
                $receivedAt = $this->resolveReceivedAt($task, $nowPK);
                $dueIn = (clone $receivedAt)->modify('+6 hours');
                $createdAt = $this->resolveCreatedAt($task, $nowPK);

                $clerkArea = $task['clerk_area'] ?? null;
                $processorNotes = isset($task['processor_notes']) ? trim((string) $task['processor_notes']) : null;
                $processorNotes = $processorNotes === '' ? null : $processorNotes;
                $safeInstruction = $this->normalizeInstructionForInsert($processorNotes, $instructionMaxLength);

                $records[] = [

                    // IDs
                    'order_number' => $task['order_id'],
                    'client_portal_id' => $clientPortalId,
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
                    'current_layer' => 'designer',
                    'workflow_type' => 'PH_2_LAYER',

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

                    'created_at' => $createdAt->format('Y-m-d H:i:s'),
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
                        Log::warning('Project19 Photo Import Row Skipped', [
                            'order_number' => $record['order_number'] ?? null,
                            'client_portal_id' => $record['client_portal_id'] ?? null,
                            'message' => $rowException->getMessage(),
                        ]);
                    }
                }

                Log::info('Project19 Photo Import Completed', [
                    'fetched' => count($records),
                    'inserted' => $inserted,
                    'skipped' => $skipped,
                    'instruction_max_length' => $instructionMaxLength,
                ]);

            } else {
                Log::warning('Project19 Photo Import: No valid records found');
            }

        } catch (Exception $e) {
            Log::error('Project19 Photo Import Error: '.$e->getMessage());
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

    private function getExistingClientPortalIds(array $tasks): array
    {
        $clientPortalIds = collect($tasks)
            ->pluck('id')
            ->filter()
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->values();

        if ($clientPortalIds->isEmpty()) {
            return [];
        }

        return DB::table($this->table)
            ->whereIn('client_portal_id', $clientPortalIds->all())
            ->pluck('client_portal_id')
            ->mapWithKeys(fn ($id) => [(string) $id => true])
            ->all();
    }

    private function resolveReceivedAt(array $task, DateTime $fallback): DateTime
    {
        if (empty($task['conduct_date'])) {
            return clone $fallback;
        }

        try {
            return new DateTime($task['conduct_date']);
        } catch (Exception $exception) {
            Log::warning('Project19 Photo Import Invalid conduct_date', [
                'client_portal_id' => $task['id'] ?? null,
                'conduct_date' => $task['conduct_date'],
                'message' => $exception->getMessage(),
            ]);

            return clone $fallback;
        }
    }

    private function resolveCreatedAt(array $task, DateTime $fallback): DateTime
    {
        if (empty($task['processing_at'])) {
            return clone $fallback;
        }

        try {
            return new DateTime($task['processing_at']);
        } catch (Exception $exception) {
            Log::warning('Project19 Photo Import Invalid processing_at', [
                'client_portal_id' => $task['id'] ?? null,
                'processing_at' => $task['processing_at'],
                'message' => $exception->getMessage(),
            ]);

            return clone $fallback;
        }
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
