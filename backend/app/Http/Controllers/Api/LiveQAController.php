<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\ProjectOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * LiveQAController
 *
 * Handles Live QA operations:
 * - List orders ready for Live QA review (drawer_done / checker_done)
 * - Get/submit checklist for an order (per drawer/checker/qa layer)
 * - CRUD product checklist items (shared across projects)
 * - View mistake reports/stats
 *
 * Live QA team works under Director/CEO and monitors all layers.
 * When drawer completes an order → Live QA can start testing drawer work.
 * When checker completes → Live QA can test checker work. Same for QA.
 */
class LiveQAController extends Controller
{
    /**
     * Limited self-service Live QA access by project.
     * This lets us enable specific role/layer combinations project-by-project
     * without changing the default Live QA behavior elsewhere.
     */
    private const LIMITED_LIVE_QA_ACCESS = [
        16 => [
            'checker' => [
                'drawer' => 'checker_id',
            ],
            'qa' => [
                'checker' => 'qa_id',
            ],
        ],
    ];

    // ─── Product Checklists (Shared Items) ─────────────────────────────

    /**
     * GET /api/live-qa/checklists
     * List all product checklist items.
     */
    public function getChecklists(Request $request)
    {
        $query = DB::table('product_checklists')->where('is_active', true);

        if ($request->has('type_id')) {
            $query->where('check_list_type_id', $request->type_id);
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    /**
     * POST /api/live-qa/checklists
     * Create a new product checklist item.
     */
    public function createChecklist(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'client' => 'nullable|string|max:500',
            'product' => 'nullable|string|max:500',
            'check_list_type_id' => 'required|integer|in:1,2,3',
            'project_id' => 'nullable|integer|exists:projects,id',
        ]);

        $insert = [
            'title' => $validated['title'],
            'client' => $validated['client'] ?? null,
            'product' => $validated['product'] ?? 'FP',
            'check_list_type_id' => $validated['check_list_type_id'],
            'sort_order' => DB::table('product_checklists')->max('sort_order') + 1,
            'is_active' => true,
            'created_by' => auth()->id(),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (!empty($validated['project_id']) && Schema::hasColumn('product_checklists', 'project_id')) {
            $insert['project_id'] = $validated['project_id'];
        }

        $id = DB::table('product_checklists')->insertGetId($insert);

        return response()->json([
            'success' => true,
            'message' => 'Checklist item created',
            'data' => DB::table('product_checklists')->find($id),
        ], 201);
    }

    /**
     * PUT /api/live-qa/checklists/{id}
     */
    public function updateChecklist(Request $request, int $id)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:500',
            'client' => 'nullable|string|max:500',
            'product' => 'nullable|string|max:500',
            'check_list_type_id' => 'sometimes|integer|in:1,2,3',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $validated['updated_at'] = now();
        DB::table('product_checklists')->where('id', $id)->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Checklist item updated',
            'data' => DB::table('product_checklists')->find($id),
        ]);
    }

    /**
     * DELETE /api/live-qa/checklists/{id}
     */
    public function deleteChecklist(int $id)
    {
        DB::table('product_checklists')->where('id', $id)->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Checklist item deactivated']);
    }

    // ─── Orders Ready for Live QA ──────────────────────────────────────

    /**
     * GET /api/live-qa/orders/{projectId}
     *
     * Lists orders ready for Live QA review with filters.
     * - layer=drawer → orders where drawer_done='yes'
     * - layer=checker → orders where checker_done='yes'
     * - layer=qa → orders where final_upload='yes'
     */
    public function getOrders(Request $request, int $projectId)
    {
        $debug = $request->boolean('debug');
        $debugSteps = [];

        try {
        $table = ProjectOrderService::getTableName($projectId);
        $debugSteps[] = ['step' => 'resolved_order_table', 'table' => $table];
        if (!Schema::hasTable($table)) {
            return response()->json(['error' => 'Project table not found'], 404);
        }

        // Ensure mistake tables exist
        if (!ProjectOrderService::mistakeTablesExist($projectId)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }
        $debugSteps[] = ['step' => 'mistake_tables_ready'];

        $layer = $request->input('layer', 'drawer');
        $perPage = $request->input('per_page', 50);
        $search = $request->input('search');
        $user = $request->user();
        $limitedAccessColumn = $this->resolveLimitedLiveQaAccessColumn($user?->role, $projectId, $layer);

        $query = DB::table($table);

        // Filter based on layer
        switch ($layer) {
            case 'drawer':
                $query->where('drawer_done', 'yes')
                      ->where('drawer_name', '!=', '');
                break;
            case 'checker':
                $query->where('checker_done', 'yes')
                      ->where('checker_name', '!=', '');
                break;
            case 'qa':
                $query->where('final_upload', 'yes')
                      ->where('qa_name', '!=', '');
                break;
        }
        $debugSteps[] = ['step' => 'layer_filter_applied', 'layer' => $layer];

        if ($this->isLimitedLiveQaUser($user?->role, $projectId)) {
            if (!$limitedAccessColumn) {
                return response()->json(['message' => 'You are not allowed to access this Live QA layer.'], 403);
            }

            $query->where($limitedAccessColumn, $user->id);
        }

        // Search
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%")
                  ->orWhere('drawer_name', 'like', "%{$search}%")
                  ->orWhere('checker_name', 'like', "%{$search}%")
                  ->orWhere('qa_name', 'like', "%{$search}%");
            });
        }

        // Date filter
        if ($request->has('date_from')) {
            $query->where('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->where('created_at', '<=', $request->date_to . ' 23:59:59');
        }

        // Add live QA status — how many checklist items are filled for this order
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);
        $totalChecklistItems = $this->resolveProjectChecklistItems($projectId, $layer)->count();

        $orders = $query->orderByDesc('id')->paginate($perPage);
        $debugSteps[] = ['step' => 'orders_paginated', 'count' => count($orders->items())];

        // Enrich with Live QA review status
        $orderIds = collect($orders->items())->pluck('order_number')->toArray();
        $reviewedCounts = [];
        if ($orderIds && Schema::hasTable($mistakeTable)) {
            $counts = DB::table($mistakeTable)
                ->whereIn('order_id', $orderIds)
                ->selectRaw('order_id, COUNT(DISTINCT product_checklist_id) as reviewed_items')
                ->groupBy('order_id')
                ->get();
            foreach ($counts as $c) {
                $reviewedCounts[$c->order_id] = $c->reviewed_items;
            }
        }
        $debugSteps[] = ['step' => 'review_counts_loaded', 'count' => count($reviewedCounts)];

        $enriched = collect($orders->items())->map(function ($order) use ($reviewedCounts, $totalChecklistItems) {
            $order->qa_reviewed_items = $reviewedCounts[$order->order_number] ?? 0;
            $order->qa_total_items = $totalChecklistItems;
            $order->qa_review_complete = $order->qa_reviewed_items >= $totalChecklistItems && $totalChecklistItems > 0;

            // Keep QA fields explicit for frontend consumers across all projects.
            $order->qa_name = $order->qa_name ?? null;
            $order->final_upload = $order->final_upload ?? null;
            $order->qa_done = strtolower((string) ($order->final_upload ?? '')) === 'yes';

            return $order;
        });

        $response = [
            'success' => true,
            'data' => $enriched,
            'pagination' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
            ],
        ];

        if ($debug) {
            $response['_debug'] = [
                'route' => 'orders',
                'project_id' => $projectId,
                'layer' => $layer,
                'schema' => $this->debugSchemaSnapshot($projectId, $layer),
                'steps' => $debugSteps,
            ];
        }

        return response()->json($response);
        } catch (\Throwable $e) {
            return $this->debugExceptionResponse($request, $e, [
                'project_id' => $projectId,
                'layer' => $request->input('layer', 'drawer'),
                'route' => 'orders',
                'steps' => $debugSteps,
            ]);
        }
    }

    // ─── Order Checklist (Live QA Review) ──────────────────────────────

    /**
     * GET /api/live-qa/review/{projectId}/{orderNumber}/{layer}
     *
     * Get checklist items with current review status for an order.
     * Returns all product_checklist items + any existing review data.
     */
     
public function getReview(Request $request, int $projectId, string $orderNumber, string $layer = 'qa')
{
    $orderNumber = rtrim($orderNumber, '/'); // Remove trailing slash
    $user = $request->user();
    $limitedAccessColumn = $this->resolveLimitedLiveQaAccessColumn($user?->role, $projectId, $layer);

    if ($this->isLimitedLiveQaUser($user?->role, $projectId) && !$limitedAccessColumn) {
        return response()->json(['message' => 'You are not allowed to access this Live QA layer.'], 403);
    }

    $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

    if (!Schema::hasTable($mistakeTable)) {
        ProjectOrderService::createMistakeTablesForProject($projectId);
    }

    $checklistItems = $this->resolveProjectChecklistItems($projectId, $layer);

    $existingReviews = DB::table($mistakeTable)
        ->where('order_id', $orderNumber)
        ->get()
        ->keyBy('product_checklist_id');

    $orderTable = ProjectOrderService::getTableName($projectId);
    $order = DB::table($orderTable)->where('order_number', $orderNumber)->first();

    if (!$order) {
        return response()->json(['message' => 'Order not found.'], 404);
    }

    if (!$this->isOrderReadyForLiveQaLayer($order, $layer)) {
        return response()->json(['message' => 'Order is not ready for this Live QA layer.'], 422);
    }

    if ($limitedAccessColumn && (int) ($order->{$limitedAccessColumn} ?? 0) !== (int) $user->id) {
        return response()->json(['message' => 'You can only access Live QA for your assigned orders.'], 403);
    }

    $workerName = match ($layer) {
        'drawer' => $order->drawer_name ?? '',
        'checker' => $order->checker_name ?? '',
        'qa' => $order->qa_name ?? '',
        default => '',
    };

    $items = $checklistItems->map(function ($item) use ($existingReviews) {
        $review = $existingReviews->get($item->id);
        return [
            'product_checklist_id' => $item->id,
            'title' => $item->title,
            'client' => $item->client,
            'product' => $item->product,
            'is_checked' => $review ? (bool) $review->is_checked : false,
            'count_value' => $review ? $review->count_value : 0,
            'text_value' => $review ? $review->text_value : '',
            'review_id' => $review ? $review->id : null,
            'created_by' => $review ? $review->created_by : null,
            'updated_at' => $review ? $review->updated_at : null,
        ];
    });

    return response()->json([
        'success' => true,
        'order_number' => $orderNumber,
        'layer' => $layer,
        'worker_name' => $workerName,
        'order' => $order,
        'items' => $items,
        'total_items' => $checklistItems->count(),
        'reviewed_items' => $items->filter(fn ($item) => !is_null($item['review_id']))->count(),
    ]);
}


    
    
    

    /**
     * POST /api/live-qa/review/{projectId}/{orderNumber}/{layer}
     *
     * Submit/update Live QA review for an order.
     * Receives array of checklist items with is_checked, count_value, text_value.
     */
    public function submitReview(Request $request, int $projectId, string $orderNumber, string $layer)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.product_checklist_id' => 'required|integer',
            'items.*.is_checked' => 'required|boolean',
            'items.*.count_value' => 'nullable|integer|min:0',
            'items.*.text_value' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $limitedAccessColumn = $this->resolveLimitedLiveQaAccessColumn($user?->role, $projectId, $layer);

        if ($this->isLimitedLiveQaUser($user?->role, $projectId) && !$limitedAccessColumn) {
            return response()->json(['message' => 'You are not allowed to access this Live QA layer.'], 403);
        }

        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        if (!Schema::hasTable($mistakeTable)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }

        // Get worker name from order
        $orderTable = ProjectOrderService::getTableName($projectId);
        $order = DB::table($orderTable)->where('order_number', $orderNumber)->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        if (!$this->isOrderReadyForLiveQaLayer($order, $layer)) {
            return response()->json(['message' => 'Order is not ready for this Live QA layer.'], 422);
        }

        if ($limitedAccessColumn && (int) ($order->{$limitedAccessColumn} ?? 0) !== (int) $user->id) {
            return response()->json(['message' => 'You can only submit Live QA for your assigned orders.'], 403);
        }

        $workerName = match ($layer) {
            'drawer' => $order->drawer_name ?? '',
            'checker' => $order->checker_name ?? '',
            'qa' => $order->qa_name ?? '',
            default => '',
        };

        $inserted = 0;
        $updated = 0;

        foreach ($validated['items'] as $item) {
            $existing = DB::table($mistakeTable)
                ->where('order_id', $orderNumber)
                ->where('product_checklist_id', $item['product_checklist_id'])
                ->first();

            $data = [
                'is_checked' => $item['is_checked'],
                'count_value' => $item['count_value'] ?? 0,
                'text_value' => $item['text_value'] ?? '',
                'updated_by' => $user->name,
                'updated_at' => now(),
            ];

            if ($existing) {
                DB::table($mistakeTable)->where('id', $existing->id)->update($data);
                $updated++;
            } else {
                $data['order_id'] = $orderNumber;
                $data['product_checklist_id'] = $item['product_checklist_id'];
                $data['worker'] = $workerName;
                $data['worker_type_id'] = 0;
                $data['created_by'] = $user->name;
                $data['created_at'] = now();
                DB::table($mistakeTable)->insert($data);
                $inserted++;
            }
        }

        // Update the d_live_qa / c_live_qa / qa_live_qa flag on the order
        $liveQaField = match ($layer) {
            'drawer' => 'd_live_qa',
            'checker' => 'c_live_qa',
            'qa' => 'qa_live_qa',
            default => null,
        };

        if ($liveQaField && $order) {
            // Count total mistakes
            $totalMistakes = DB::table($mistakeTable)
                ->where('order_id', $orderNumber)
                ->sum('count_value');

            DB::table($orderTable)
                ->where('id', $order->id)
                ->update([$liveQaField => $totalMistakes]);
        }

        return response()->json([
            'success' => true,
            'message' => "Review saved: {$inserted} new, {$updated} updated",
            'inserted' => $inserted,
            'updated' => $updated,
        ]);
    }

    // ─── Stats / Reports ───────────────────────────────────────────────

    /**
     * GET /api/live-qa/overview/{projectId}
     *
     * Unified view of ALL orders with Drawer, D-LiveQA, Checker, C-LiveQA columns.
     * Matches the old Metro system layout.
     */
    public function getOverview(Request $request, int $projectId)
    {
        if ($request->boolean('debug')) {
            $table = ProjectOrderService::getTableName($projectId);

            return response()->json([
                'debug_hit' => true,
                'route' => 'overview',
                'project_id' => $projectId,
                'table' => $table,
                'schema' => $this->debugSchemaSnapshot($projectId, 'drawer'),
                'request' => [
                    'date' => $request->input('date'),
                    'from_datetime' => $request->input('from_datetime'),
                    'to_datetime' => $request->input('to_datetime'),
                    'search' => $request->input('search'),
                    'filter' => $request->input('filter', 'all'),
                ],
            ]);
        }

        $perPage = $request->input('per_page', 50);
$search = $request->input('search');
$filter = $request->input('filter', 'all');
$dateStr = $request->input('date');

// ✅ ADD THESE HERE (important)
$fromDateTime = $request->input('from_datetime');
$toDateTime   = $request->input('to_datetime');
        $table = ProjectOrderService::getTableName($projectId);
        if (!Schema::hasTable($table)) {
            return response()->json(['error' => 'Project table not found'], 404);
        }

        // Ensure mistake tables exist
        if (!ProjectOrderService::mistakeTablesExist($projectId)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }

        $perPage = $request->input('per_page', 50);
        $search = $request->input('search');
        $filter = $request->input('filter', 'all'); // all, pending, completed, amends
        $dateStr = $request->input('date'); // specific date or 'today'

        // Explicit column selection — avoids returning JSON columns (metadata,
        // attachments) which can cause React error #310 if the serialization
        // pipeline ever emits them as parsed objects instead of strings.
        $selectCols = [
            'id', 'order_number', 'address', 'client_name', 'priority',
            'workflow_state', 'status', 'assigned_to',
            'drawer_name', 'drawer_done', 'drawer_date', 'dassign_time',
            'checker_name', 'checker_done', 'checker_date', 'cassign_time',
            'final_upload', 'amend', 'd_live_qa', 'c_live_qa',
            'due_in', 'received_at', 'created_at',
        ];
        if (Schema::hasColumn($table, 'qa_name')) {
            $selectCols[] = 'qa_name';
        }
        // Add VARIANT_no if the column exists in this project table
        if (Schema::hasColumn($table, 'VARIANT_no')) {
            $selectCols[] = 'VARIANT_no';
        }

        $query = DB::table($table)
            ->select($selectCols)
            ->where('drawer_name', '!=', '')
            ->whereNotNull('drawer_name');

        // Date filter — no default date restriction so Live QA sees all
        // orders needing review regardless of when they were created.
        // Users can manually pick a date to narrow down.
        $this->applyLiveQaOverviewDateFilter($query, $projectId, $dateStr, $fromDateTime, $toDateTime);

        // If no date specified → show all orders (no date filter)

        // Status filter
        switch ($filter) {
            case 'pending':
                $query->where(function ($q) {
                    $q->whereNull('final_upload')
                      ->orWhere('final_upload', '')
                      ->orWhere('final_upload', '!=', 'yes');
                });
                break;
            case 'completed':
                $query->where('final_upload', 'yes');
                break;
            case 'amends':
                $query->where('amend', '>', 0);
                break;
            case 'unassigned':
                $query->whereNull('assigned_to')
                      ->where(function ($q) {
                          $q->whereNull('final_upload')
                            ->orWhere('final_upload', '')
                            ->orWhere('final_upload', '!=', 'yes');
                      });
                break;
        }

        // Search
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%")
                  ->orWhere('drawer_name', 'like', "%{$search}%")
                  ->orWhere('checker_name', 'like', "%{$search}%");
            });
        }

        $orders = $query->orderByDesc('id')->paginate($perPage);

        // Get D-LiveQA and C-LiveQA review counts
        $drawerMistakeTable = ProjectOrderService::getMistakeTableName($projectId, 'drawer');
        $checkerMistakeTable = ProjectOrderService::getMistakeTableName($projectId, 'checker');
        $drawerChecklistItems = $this->resolveProjectChecklistItems($projectId, 'drawer')->count();
        $checkerChecklistItems = $this->resolveProjectChecklistItems($projectId, 'checker')->count();

        $orderNumbers = collect($orders->items())->pluck('order_number')->toArray();
        $dReviewCounts = [];
        $cReviewCounts = [];

        if ($orderNumbers) {
            if (Schema::hasTable($drawerMistakeTable)) {
                $dCounts = DB::table($drawerMistakeTable)
                    ->whereIn('order_id', $orderNumbers)
                    ->selectRaw('order_id, COUNT(DISTINCT product_checklist_id) as reviewed_items')
                    ->groupBy('order_id')
                    ->get();
                foreach ($dCounts as $c) {
                    $dReviewCounts[$c->order_id] = $c->reviewed_items;
                }
            }
            if (Schema::hasTable($checkerMistakeTable)) {
                $cCounts = DB::table($checkerMistakeTable)
                    ->whereIn('order_id', $orderNumbers)
                    ->selectRaw('order_id, COUNT(DISTINCT product_checklist_id) as reviewed_items')
                    ->groupBy('order_id')
                    ->get();
                foreach ($cCounts as $c) {
                    $cReviewCounts[$c->order_id] = $c->reviewed_items;
                }
            }
        }

        $enriched = collect($orders->items())->map(function ($order) use ($dReviewCounts, $cReviewCounts, $drawerChecklistItems, $checkerChecklistItems) {
            $order->d_qa_reviewed = $dReviewCounts[$order->order_number] ?? 0;
            $order->d_qa_total = $drawerChecklistItems;
            $order->d_qa_done = ($order->d_qa_reviewed >= $drawerChecklistItems && $drawerChecklistItems > 0);

            $order->c_qa_reviewed = $cReviewCounts[$order->order_number] ?? 0;
            $order->c_qa_total = $checkerChecklistItems;
            $order->c_qa_done = ($order->c_qa_reviewed >= $checkerChecklistItems && $checkerChecklistItems > 0);

            // Keep QA fields explicit for frontend consumers across projects.
            $order->qa_name = $order->qa_name ?? null;
            $order->final_upload = $order->final_upload ?? null;
            $order->qa_done = strtolower((string) ($order->final_upload ?? '')) === 'yes';

            return $order;
        });

        // Get counts for the stat buttons (for current date filter)
        $countQuery = DB::table($table)
            ->where('drawer_name', '!=', '')
            ->whereNotNull('drawer_name');

        $this->applyLiveQaOverviewDateFilter($countQuery, $projectId, $dateStr, $fromDateTime, $toDateTime);
        // If no date specified → count all orders (matches main query)

        $todayTotal = (clone $countQuery)->count();
        $pendingCount = (clone $countQuery)->where(function ($q) {
            $q->whereNull('final_upload')->orWhere('final_upload', '')->orWhere('final_upload', '!=', 'yes');
        })->count();
        $completedCount = (clone $countQuery)->where('final_upload', 'yes')->count();
        $amendsCount = (clone $countQuery)->where('amend', '>', 0)->count();
        $unassignedCount = (clone $countQuery)->whereNull('assigned_to')->where(function ($q) {
            $q->whereNull('final_upload')->orWhere('final_upload', '')->orWhere('final_upload', '!=', 'yes');
        })->count();

        return response()->json([
            'success' => true,
            'data' => $enriched,
            'counts' => [
                'today_total' => $todayTotal,
                'pending' => $pendingCount,
                'completed' => $completedCount,
                'amends' => $amendsCount,
                'unassigned' => $unassignedCount,
            ],
            'pagination' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/live-qa/mistake-summary/{projectId}/{layer}
     *
     * Detailed mistake summary report per worker, grouped by team.
     * Returns pivot-ready data: workers with team info, plan counts, per-checklist mistakes.
     */
    public function mistakeSummary(Request $request, int $projectId, string $layer)
    {
        $debug = $request->boolean('debug');
        $debugSteps = [];

        try {
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);
        $debugSteps[] = ['step' => 'resolved_mistake_table', 'table' => $mistakeTable];

        if (!Schema::hasTable($mistakeTable)) {
            return response()->json([
                'success' => true,
                'data' => [],
                'teams' => [],
                'checklist_items' => [],
                'order_comments' => [],
                'summary' => ['total_orders' => 0, 'total_mistakes' => 0],
            ]);
        }

        $checklistItemsCollection = $this->resolveProjectChecklistItems($projectId, $layer);
        $checklistIds = $checklistItemsCollection->pluck('id')->all();
        [$dateFrom, $dateTo, $fromDateTime, $toDateTime] = $this->resolveLiveQaReportRange($request);
        $debugSteps[] = [
            'step' => 'resolved_checklists',
            'count' => count($checklistIds),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'from_datetime' => $fromDateTime,
            'to_datetime' => $toDateTime,
        ];

        $workerFilter = $request->input('worker');

        // Build base query with date filters
        $baseWhere = function ($q) use ($mistakeTable, $dateFrom, $dateTo, $fromDateTime, $toDateTime, $workerFilter, $checklistIds) {
            $q->where("{$mistakeTable}.worker", '!=', '')
              ->whereNotNull("{$mistakeTable}.worker");
            if (!empty($checklistIds)) {
                $q->whereIn("{$mistakeTable}.product_checklist_id", $checklistIds);
            }
            if ($fromDateTime && $toDateTime) {
                $q->whereBetween("{$mistakeTable}.created_at", [$fromDateTime, $toDateTime]);
            } else {
                if ($dateFrom) $q->where("{$mistakeTable}.created_at", '>=', $dateFrom);
                if ($dateTo)   $q->where("{$mistakeTable}.created_at", '<=', $dateTo . ' 23:59:59');
            }
            if ($workerFilter) $q->where("{$mistakeTable}.worker", 'like', "%{$workerFilter}%");
        };

        // Get ordered checklist items for this project only
        $checklistItems = $checklistItemsCollection
            ->pluck('title')
            ->toArray();

        // Per-worker, per-checklist-item breakdown
        $details = DB::table($mistakeTable)
            ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
            ->where($baseWhere)
            ->selectRaw("
                {$mistakeTable}.worker,
                product_checklists.title as checklist_item,
                SUM({$mistakeTable}.count_value) as mistake_count,
                COUNT(DISTINCT {$mistakeTable}.order_id) as orders_affected
            ")
            ->groupBy("{$mistakeTable}.worker", 'product_checklists.title')
            ->orderBy("{$mistakeTable}.worker")
            ->get();
        $debugSteps[] = ['step' => 'loaded_details', 'count' => $details->count()];

        $orderTable = ProjectOrderService::getTableName($projectId);
        $hasClientName = Schema::hasTable($orderTable) && Schema::hasColumn($orderTable, 'client_name');

        $orderCommentsSelect = [
            "{$mistakeTable}.id",
            "{$mistakeTable}.order_id",
            "{$mistakeTable}.worker",
            'product_checklists.title as checklist_item',
            "{$mistakeTable}.count_value",
            "{$mistakeTable}.text_value",
            "{$mistakeTable}.created_at",
            "{$mistakeTable}.updated_at",
        ];
        if ($hasClientName) {
            $orderCommentsSelect[] = "{$orderTable}.client_name";
        }

        $orderComments = DB::table($mistakeTable)
            ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
            ->when($hasClientName, fn ($q) => $q->leftJoin($orderTable, "{$orderTable}.order_number", '=', "{$mistakeTable}.order_id"))
            ->where($baseWhere)
            ->where('text_value', '!=', '')
            ->select($orderCommentsSelect)
            ->orderByDesc("{$mistakeTable}.updated_at")
            ->orderByDesc("{$mistakeTable}.id")
            ->get();
        $debugSteps[] = ['step' => 'loaded_order_comments', 'count' => $orderComments->count()];

        $reportRows = collect();
        $debugSteps[] = ['step' => 'resolved_order_table', 'table' => $orderTable];

        if (Schema::hasTable($orderTable)) {
            $sourceSelectCols = [
                "{$mistakeTable}.order_id",
                "{$mistakeTable}.count_value",
                "{$mistakeTable}.text_value",
                "{$mistakeTable}.created_at as review_created_at",
                'product_checklists.title as checklist_item',
                "{$orderTable}.received_at as first_order_date",
                "{$orderTable}.drawer_name",
                "{$orderTable}.checker_name",
                "{$orderTable}.qa_name",
            ];
            if ($hasClientName) {
                $sourceSelectCols[] = "{$orderTable}.client_name";
            }

            $reportSourceRows = DB::table($mistakeTable)
                ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
                ->leftJoin($orderTable, "{$orderTable}.order_number", '=', "{$mistakeTable}.order_id")
                ->where($baseWhere)
                ->select($sourceSelectCols)
                ->orderBy("{$mistakeTable}.order_id")
                ->orderBy('product_checklists.sort_order')
                ->orderBy('product_checklists.id')
                ->get();
            $debugSteps[] = ['step' => 'loaded_report_source_rows', 'count' => $reportSourceRows->count()];

            $nullChecklistMap = array_fill_keys($checklistItems, null);

            $reportRows = $reportSourceRows
                ->groupBy('order_id')
                ->map(function ($rows, $orderId) use ($nullChecklistMap, $hasClientName) {
                    $firstRow = $rows->first();
                    $liveQaTime = $rows->min('review_created_at');

                    $rowData = [
                        'order_number' => $orderId,
                        'client_name' => $hasClientName ? ($firstRow->client_name ?? null) : null,
                        'first_order_date' => $firstRow->first_order_date ?: $firstRow->review_created_at,
                        'live_qa_time' => $liveQaTime,
                        'drawer_name' => $firstRow->drawer_name,
                        'checker_name' => $firstRow->checker_name,
                        'qa_name' => $firstRow->qa_name,
                    ] + $nullChecklistMap;

                    $totalMistakes = 0;

                    foreach ($rows as $row) {
                        $countValue = (int) $row->count_value;
                        $totalMistakes += $countValue;

                        if (array_key_exists($row->checklist_item, $rowData) && $countValue > 0) {
                            $rowData[$row->checklist_item] = ($rowData[$row->checklist_item] ?? 0) + $countValue;
                        }
                    }

                    $rowData['total_mistakes'] = $totalMistakes;

                    return $rowData;
                })
                ->sortBy('live_qa_time')
                ->values();
            $debugSteps[] = ['step' => 'built_report_rows', 'count' => $reportRows->count()];
        }

        // Plan count per worker (distinct orders reviewed)
        $planCounts = DB::table($mistakeTable)
            ->where($baseWhere)
            ->selectRaw("worker, COUNT(DISTINCT order_id) as plan_count")
            ->groupBy('worker')
            ->pluck('plan_count', 'worker')
            ->toArray();
        $debugSteps[] = ['step' => 'loaded_plan_counts', 'count' => count($planCounts)];

        // Build worker → team mapping from users table
        // Match by name since mistake table stores worker name, not ID
        $workerNames = array_unique($details->pluck('worker')->toArray());

        $userTeams = DB::table('users')
            ->leftJoin('teams', 'teams.id', '=', 'users.team_id')
            ->where('users.project_id', $projectId)
            ->whereIn('users.name', $workerNames)
            ->select('users.name', 'teams.id as team_id', 'teams.name as team_name')
            ->get()
            ->keyBy('name');
        $debugSteps[] = ['step' => 'loaded_user_teams', 'count' => $userTeams->count()];

        // Build team-grouped structure
        $teamGroups = [];
        $unassignedWorkers = [];

        foreach ($details as $row) {
            $workerName = $row->worker;
            $teamInfo = $userTeams->get($workerName);
            $teamName = $teamInfo ? $teamInfo->team_name : 'Unassigned Team';
            $teamId = $teamInfo ? $teamInfo->team_id : 0;

            if (!isset($teamGroups[$teamId])) {
                $teamGroups[$teamId] = [
                    'team_id' => $teamId,
                    'team_name' => $teamName,
                    'workers' => [],
                ];
            }

            if (!isset($teamGroups[$teamId]['workers'][$workerName])) {
                $teamGroups[$teamId]['workers'][$workerName] = [
                    'name' => $workerName,
                    'plan_count' => $planCounts[$workerName] ?? 0,
                    'items' => [],
                    'mistake_total' => 0,
                ];
            }

            $teamGroups[$teamId]['workers'][$workerName]['items'][$row->checklist_item] = (int) $row->mistake_count;
            $teamGroups[$teamId]['workers'][$workerName]['mistake_total'] += (int) $row->mistake_count;
        }

        // Convert workers from associative to indexed arrays, sort by plan_count desc
        foreach ($teamGroups as &$group) {
            $group['workers'] = array_values($group['workers']);
            usort($group['workers'], fn ($a, $b) => $b['plan_count'] <=> $a['plan_count']);
        }
        unset($group);

        // Sort teams: Unassigned (id=0) first, then by team_name
        $teams = array_values($teamGroups);
        usort($teams, function ($a, $b) {
            if ($a['team_id'] === 0) return -1;
            if ($b['team_id'] === 0) return 1;
            return strcmp($a['team_name'], $b['team_name']);
        });

        // Summary totals
        $summaryQuery = DB::table($mistakeTable)->where($baseWhere);
        $totalOrders = (clone $summaryQuery)->distinct('order_id')->count('order_id');
        $totalMistakes = (clone $summaryQuery)->where('count_value', '>', 0)->sum('count_value');
        $response = [
            'success' => true,
            'layer' => $layer,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'from_datetime' => $fromDateTime,
            'to_datetime' => $toDateTime,
            'teams' => $teams,
            'checklist_items' => $checklistItems,
            'report_columns' => array_merge(
                ['order_number', 'client_name', 'first_order_date', 'live_qa_time', 'drawer_name', 'checker_name', 'qa_name'],
                $checklistItems,
                ['total_mistakes']
            ),
            'report_rows' => $reportRows,
            'data' => $details, // keep backward compat
            'order_comments' => $orderComments,
            'summary' => [
                'total_orders' => $totalOrders,
                'total_mistakes' => $totalMistakes,
            ],
        ];

        if ($debug) {
            $response['_debug'] = [
                'route' => 'mistake-summary',
                'project_id' => $projectId,
                'layer' => $layer,
                'schema' => $this->debugSchemaSnapshot($projectId, $layer),
                'steps' => $debugSteps,
            ];
        }

        return response()->json($response);
        } catch (\Throwable $e) {
            return $this->debugExceptionResponse($request, $e, [
                'project_id' => $projectId,
                'layer' => $layer,
                'route' => 'mistake-summary',
                'steps' => $debugSteps,
            ]);
        }
    }

    /**
     * GET /api/live-qa/stats/{projectId}
     *
     * Get Live QA statistics for a project.
     */
    public function stats(Request $request, int $projectId)
    {
        $debug = $request->boolean('debug');
        $debugSteps = [];

        try {
        $layer = $request->input('layer', 'drawer');
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);
        $debugSteps[] = ['step' => 'resolved_mistake_table', 'table' => $mistakeTable];

        if (!Schema::hasTable($mistakeTable)) {
            return response()->json([
                'success' => true,
                'total_reviews' => 0,
                'total_mistakes' => 0,
                'orders_reviewed' => 0,
                'worker_stats' => [],
                'checklist_stats' => [],
                'order_comments' => [],
                'report_columns' => [],
                'report_rows' => [],
            ]);
        }

        $checklistItemsCollection = $this->resolveProjectChecklistItems($projectId, $layer);
        $checklistItems = $checklistItemsCollection->pluck('title')->toArray();
        $checklistIds = $checklistItemsCollection->pluck('id')->all();
        [$dateFrom, $dateTo, $fromDateTime, $toDateTime] = $this->resolveLiveQaReportRange($request);
        $workerFilter = $request->input('worker');
        $debugSteps[] = [
            'step' => 'resolved_checklists',
            'count' => count($checklistIds),
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'from_datetime' => $fromDateTime,
            'to_datetime' => $toDateTime,
        ];

        $baseQuery = DB::table($mistakeTable)
            ->when(!empty($checklistIds), fn ($q) => $q->whereIn("{$mistakeTable}.product_checklist_id", $checklistIds))
            ->when($fromDateTime && $toDateTime, fn ($q) => $q->whereBetween("{$mistakeTable}.created_at", [$fromDateTime, $toDateTime]))
            ->when(!$fromDateTime && !$toDateTime && $dateFrom, fn ($q) => $q->where("{$mistakeTable}.created_at", '>=', $dateFrom))
            ->when(!$fromDateTime && !$toDateTime && $dateTo, fn ($q) => $q->where("{$mistakeTable}.created_at", '<=', $dateTo . ' 23:59:59'))
            ->when($workerFilter, fn ($q) => $q->where("{$mistakeTable}.worker", 'like', "%{$workerFilter}%"));

        $totalReviews = (clone $baseQuery)->count();
        $totalMistakes = (clone $baseQuery)->where("{$mistakeTable}.count_value", '>', 0)->sum("{$mistakeTable}.count_value");
        $ordersReviewed = (clone $baseQuery)->distinct()->count("{$mistakeTable}.order_id");
        $debugSteps[] = [
            'step' => 'computed_totals',
            'total_reviews' => $totalReviews,
            'total_mistakes' => $totalMistakes,
            'orders_reviewed' => $ordersReviewed,
        ];

        // Mistakes per worker
        $workerStats = (clone $baseQuery)
            ->where("{$mistakeTable}.worker", '!=', '')
            ->whereNotNull("{$mistakeTable}.worker")
            ->selectRaw("{$mistakeTable}.worker, COUNT(DISTINCT {$mistakeTable}.order_id) as orders_checked, SUM({$mistakeTable}.count_value) as total_mistakes")
            ->groupBy("{$mistakeTable}.worker")
            ->orderByDesc('total_mistakes')
            ->limit(50)
            ->get();
        $debugSteps[] = ['step' => 'loaded_worker_stats', 'count' => $workerStats->count()];

        // Mistakes per checklist item
        $checklistStats = (clone $baseQuery)
            ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
            ->selectRaw("product_checklists.title, SUM({$mistakeTable}.count_value) as total_mistakes, COUNT(DISTINCT {$mistakeTable}.order_id) as orders_affected")
            ->groupBy('product_checklists.title')
            ->orderByDesc('total_mistakes')
            ->get();
        $debugSteps[] = ['step' => 'loaded_checklist_stats', 'count' => $checklistStats->count()];

        $orderComments = (clone $baseQuery)
            ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
            ->where("{$mistakeTable}.text_value", '!=', '')
            ->select(
                "{$mistakeTable}.id",
                "{$mistakeTable}.order_id",
                "{$mistakeTable}.worker",
                'product_checklists.title as checklist_item',
                "{$mistakeTable}.count_value",
                "{$mistakeTable}.text_value",
                "{$mistakeTable}.created_at",
                "{$mistakeTable}.updated_at"
            )
            ->orderByDesc("{$mistakeTable}.updated_at")
            ->orderByDesc("{$mistakeTable}.id")
            ->get();
        $debugSteps[] = ['step' => 'loaded_order_comments', 'count' => $orderComments->count()];

        $orderTable = ProjectOrderService::getTableName($projectId);
        $reportRows = collect();
        $debugSteps[] = ['step' => 'resolved_order_table', 'table' => $orderTable];

        if (Schema::hasTable($orderTable)) {
            $hasClientName = Schema::hasColumn($orderTable, 'client_name');
            $sourceSelectCols = [
                "{$mistakeTable}.order_id",
                "{$mistakeTable}.count_value",
                "{$mistakeTable}.text_value",
                "{$mistakeTable}.created_at as review_created_at",
                'product_checklists.title as checklist_item',
                "{$orderTable}.received_at as first_order_date",
                "{$orderTable}.drawer_name",
                "{$orderTable}.checker_name",
                "{$orderTable}.qa_name",
            ];
            if ($hasClientName) {
                $sourceSelectCols[] = "{$orderTable}.client_name";
            }

            $reportSourceRows = (clone $baseQuery)
                ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
                ->leftJoin($orderTable, "{$orderTable}.order_number", '=', "{$mistakeTable}.order_id")
                ->select($sourceSelectCols)
                ->orderBy("{$mistakeTable}.order_id")
                ->orderBy('product_checklists.sort_order')
                ->orderBy('product_checklists.id')
                ->get();
            $debugSteps[] = ['step' => 'loaded_report_source_rows', 'count' => $reportSourceRows->count()];

            $nullChecklistMap = array_fill_keys($checklistItems, null);

            $reportRows = $reportSourceRows
                ->groupBy('order_id')
                ->map(function ($rows, $orderId) use ($nullChecklistMap, $hasClientName) {
                    $firstRow = $rows->first();
                    $liveQaTime = $rows->min('review_created_at');

                    $rowData = [
                        'order_number' => $orderId,
                        'client_name' => $hasClientName ? ($firstRow->client_name ?? null) : null,
                        'first_order_date' => $firstRow->first_order_date ?: $firstRow->review_created_at,
                        'live_qa_time' => $liveQaTime,
                        'drawer_name' => $firstRow->drawer_name,
                        'checker_name' => $firstRow->checker_name,
                        'qa_name' => $firstRow->qa_name,
                    ] + $nullChecklistMap;

                    $totalMistakes = 0;

                    foreach ($rows as $row) {
                        $countValue = (int) $row->count_value;
                        $totalMistakes += $countValue;

                        if (array_key_exists($row->checklist_item, $rowData) && $countValue > 0) {
                            $rowData[$row->checklist_item] = ($rowData[$row->checklist_item] ?? 0) + $countValue;
                        }
                    }

                    $rowData['total_mistakes'] = $totalMistakes;

                    return $rowData;
                })
                ->sortBy('live_qa_time')
                ->values();
            $debugSteps[] = ['step' => 'built_report_rows', 'count' => $reportRows->count()];
        }

        $response = [
            'success' => true,
            'layer' => $layer,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'from_datetime' => $fromDateTime,
            'to_datetime' => $toDateTime,
            'total_reviews' => $totalReviews,
            'total_mistakes' => $totalMistakes,
            'orders_reviewed' => $ordersReviewed,
            'worker_stats' => $workerStats,
            'checklist_stats' => $checklistStats,
            'order_comments' => $orderComments,
            'report_columns' => array_merge(
                ['order_number', 'client_name', 'first_order_date', 'live_qa_time', 'drawer_name', 'checker_name', 'qa_name'],
                $checklistItems,
                ['total_mistakes']
            ),
            'report_rows' => $reportRows,
        ];

        if ($debug) {
            $response['_debug'] = [
                'route' => 'stats',
                'project_id' => $projectId,
                'layer' => $layer,
                'schema' => $this->debugSchemaSnapshot($projectId, $layer),
                'steps' => $debugSteps,
            ];
        }

        return response()->json($response);
        } catch (\Throwable $e) {
            return $this->debugExceptionResponse($request, $e, [
                'project_id' => $projectId,
                'layer' => $request->input('layer', 'drawer'),
                'route' => 'stats',
                'steps' => $debugSteps,
            ]);
        }
    }

    private function resolveLiveQaReportRange(Request $request): array
    {
        $fromDateTime = $request->input('from_datetime');
        $toDateTime = $request->input('to_datetime');

        if ($fromDateTime && $toDateTime) {
            return [null, null, $fromDateTime, $toDateTime];
        }

        $dateFrom = $request->input('date_from') ?: now()->toDateString();
        $dateTo = $request->input('date_to') ?: now()->toDateString();

        return [$dateFrom, $dateTo, null, null];
    }

    private function applyLiveQaOverviewDateFilter($query, int $projectId, ?string $dateStr, ?string $fromDateTime, ?string $toDateTime): void
    {
        if ($fromDateTime && $toDateTime) {
            $query->whereBetween('received_at', [$fromDateTime, $toDateTime]);
            return;
        }

        if ($dateStr === 'all') {
            return;
        }

        if ($projectId === 16) {
            $timezone = 'Asia/Karachi';
            $selectedDate = (!$dateStr || $dateStr === 'today')
                ? now($timezone)->toDateString()
                : $dateStr;

            $windowEnd = \Carbon\Carbon::parse($selectedDate, $timezone)->setTime(22, 0, 0);
            $windowStart = $windowEnd->copy()->subDay();

            $query->where('received_at', '>=', $windowStart->format('Y-m-d H:i:s'))
                ->where('received_at', '<', $windowEnd->format('Y-m-d H:i:s'));
            return;
        }

        if (!$dateStr || $dateStr === 'today') {
            $query->whereDate('received_at', now()->toDateString());
            return;
        }

        $query->whereDate('received_at', $dateStr);
    }

    private function resolveProjectChecklistItems(int $projectId, ?string $layer = null)
    {
        $projectClientName = trim((string) optional(
            Project::query()->select('client_name')->find($projectId)
        )->client_name);

        $baseChecklistQuery = DB::table('product_checklists')
            ->where('is_active', true);

        $hasProjectIdColumn = Schema::hasColumn('product_checklists', 'project_id');
        $hasClientColumn = Schema::hasColumn('product_checklists', 'client');

        $hasProjectSpecificItems = false;
        if ($hasProjectIdColumn) {
            $hasProjectSpecificItems = (clone $baseChecklistQuery)
                ->where('project_id', $projectId)
                ->exists();
        }

        $hasClientSpecificItems = false;
        if (!$hasProjectSpecificItems && $hasClientColumn && $projectClientName !== '') {
            $hasClientSpecificItems = (clone $baseChecklistQuery)
                ->where('client', $projectClientName)
                ->exists();
        }

        $items = (clone $baseChecklistQuery)
            ->when($hasProjectIdColumn && $hasProjectSpecificItems, function ($query) use ($projectId) {
                $query->where('project_id', $projectId);
            }, function ($query) use ($hasProjectIdColumn, $hasClientColumn, $hasClientSpecificItems, $projectClientName) {
                if ($hasClientColumn && $hasClientSpecificItems) {
                    $query->where('client', $projectClientName);
                    return;
                }

                if ($hasProjectIdColumn) {
                    $query->whereNull('project_id');
                }
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $layerChecklistTypeId = match ($layer) {
            'drawer' => 1,
            'checker' => 2,
            'qa' => 3,
            default => null,
        };

        if (is_null($layerChecklistTypeId)) {
            return $items;
        }

        $layerItems = $items->where('check_list_type_id', $layerChecklistTypeId)->values();

        return $layerItems->isNotEmpty() ? $layerItems : $items->values();
    }

    private function isLimitedLiveQaUser(?string $role, int $projectId): bool
    {
        return isset(self::LIMITED_LIVE_QA_ACCESS[$projectId][$role ?? '']);
    }

    private function resolveLimitedLiveQaAccessColumn(?string $role, int $projectId, string $layer): ?string
    {
        return self::LIMITED_LIVE_QA_ACCESS[$projectId][$role ?? ''][$layer] ?? null;
    }

    private function isOrderReadyForLiveQaLayer(object $order, string $layer): bool
    {
        return match ($layer) {
            'drawer' => ($order->drawer_done ?? null) === 'yes' && !empty($order->drawer_name),
            'checker' => ($order->checker_done ?? null) === 'yes' && !empty($order->checker_name),
            'qa' => ($order->final_upload ?? null) === 'yes',
            default => false,
        };
    }

    private function debugExceptionResponse(Request $request, \Throwable $e, array $context = [])
    {
        if ($request->boolean('debug')) {
            return response()->json([
                'success' => false,
                'message' => 'Debug exception',
                'exception_class' => get_class($e),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'context' => $context,
                'schema' => isset($context['project_id'])
                    ? $this->debugSchemaSnapshot((int) $context['project_id'], (string) ($context['layer'] ?? 'drawer'))
                    : null,
            ], 500);
        }

        return response()->json([
            'message' => 'Internal server error',
            'error' => class_basename($e),
        ], 500);
    }

    private function debugSchemaSnapshot(int $projectId, string $layer): array
    {
        $orderTable = ProjectOrderService::getTableName($projectId);
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        return [
            'order_table' => $orderTable,
            'mistake_table' => $mistakeTable,
            'order_table_exists' => Schema::hasTable($orderTable),
            'mistake_table_exists' => Schema::hasTable($mistakeTable),
            'order_number_type' => $this->getColumnType($orderTable, 'order_number'),
            'mistake_order_id_type' => $this->getColumnType($mistakeTable, 'order_id'),
            'checklist_count' => $this->resolveProjectChecklistItems($projectId, $layer)->count(),
        ];
    }

    private function getColumnType(string $table, string $column): ?string
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return null;
        }

        return DB::table('information_schema.columns')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('column_type');
    }
}




