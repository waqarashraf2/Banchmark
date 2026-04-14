<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        ]);

        $id = DB::table('product_checklists')->insertGetId([
            'title' => $validated['title'],
            'client' => $validated['client'] ?? 'Schematic',
            'product' => $validated['product'] ?? 'FP',
            'check_list_type_id' => $validated['check_list_type_id'],
            'sort_order' => DB::table('product_checklists')->max('sort_order') + 1,
            'is_active' => true,
            'created_by' => auth()->id(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

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
        $table = ProjectOrderService::getTableName($projectId);
        if (!Schema::hasTable($table)) {
            return response()->json(['error' => 'Project table not found'], 404);
        }

        // Ensure mistake tables exist
        if (!ProjectOrderService::mistakeTablesExist($projectId)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }

        $layer = $request->input('layer', 'drawer');
        $perPage = $request->input('per_page', 50);
        $search = $request->input('search');

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
                $query->where('final_upload', 'yes');
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

        // Date filter
        if ($request->has('date_from')) {
            $query->where('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to')) {
            $query->where('created_at', '<=', $request->date_to . ' 23:59:59');
        }

        // Add live QA status — how many checklist items are filled for this order
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);
        $totalChecklistItems = DB::table('product_checklists')
            ->where('is_active', true)
            ->count();

        $orders = $query->orderByDesc('id')->paginate($perPage);

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

        $enriched = collect($orders->items())->map(function ($order) use ($reviewedCounts, $totalChecklistItems) {
            $order->qa_reviewed_items = $reviewedCounts[$order->order_number] ?? 0;
            $order->qa_total_items = $totalChecklistItems;
            $order->qa_review_complete = $order->qa_reviewed_items >= $totalChecklistItems && $totalChecklistItems > 0;
            return $order;
        });

        return response()->json([
            'success' => true,
            'data' => $enriched,
            'pagination' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
            ],
        ]);
    }

    // ─── Order Checklist (Live QA Review) ──────────────────────────────

    /**
     * GET /api/live-qa/review/{projectId}/{orderNumber}/{layer}
     *
     * Get checklist items with current review status for an order.
     * Returns all product_checklist items + any existing review data.
     */
    public function getReview(Request $request, int $projectId, string $orderNumber, string $layer)
    {
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        // Ensure table exists
        if (!Schema::hasTable($mistakeTable)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }

        // Get all active checklist items
        $checklistItems = DB::table('product_checklists')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        // Get existing review data for this order
        $existingReviews = DB::table($mistakeTable)
            ->where('order_id', $orderNumber)
            ->get()
            ->keyBy('product_checklist_id');

        // Get order details
        $orderTable = ProjectOrderService::getTableName($projectId);
        $order = DB::table($orderTable)->where('order_number', $orderNumber)->first();

        // Determine the worker being checked
        $workerName = match ($layer) {
            'drawer' => $order->drawer_name ?? '',
            'checker' => $order->checker_name ?? '',
            'qa' => $order->qa_name ?? '',
            default => '',
        };

        // Merge checklist items with review data
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
            'order' => $order ? [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'address' => $order->address ?? '',
                'drawer_name' => $order->drawer_name ?? '',
                'checker_name' => $order->checker_name ?? '',
                'qa_name' => $order->qa_name ?? '',
                'drawer_done' => $order->drawer_done ?? '',
                'checker_done' => $order->checker_done ?? '',
                'final_upload' => $order->final_upload ?? '',
            ] : null,
            'items' => $items,
            'total_items' => $checklistItems->count(),
            'reviewed_items' => $existingReviews->count(),
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

        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        if (!Schema::hasTable($mistakeTable)) {
            ProjectOrderService::createMistakeTablesForProject($projectId);
        }

        // Get worker name from order
        $orderTable = ProjectOrderService::getTableName($projectId);
        $order = DB::table($orderTable)->where('order_number', $orderNumber)->first();
        $workerName = match ($layer) {
            'drawer' => $order->drawer_name ?? '',
            'checker' => $order->checker_name ?? '',
            'qa' => $order->qa_name ?? '',
            default => '',
        };

        $user = auth()->user();
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
        if ($dateStr && $dateStr !== 'all') {
            $query->whereDate('created_at', $dateStr);
        }
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
        $totalChecklistItems = DB::table('product_checklists')->where('is_active', true)->count();

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

        $enriched = collect($orders->items())->map(function ($order) use ($dReviewCounts, $cReviewCounts, $totalChecklistItems) {
            $order->d_qa_reviewed = $dReviewCounts[$order->order_number] ?? 0;
            $order->d_qa_total = $totalChecklistItems;
            $order->d_qa_done = ($order->d_qa_reviewed >= $totalChecklistItems && $totalChecklistItems > 0);

            $order->c_qa_reviewed = $cReviewCounts[$order->order_number] ?? 0;
            $order->c_qa_total = $totalChecklistItems;
            $order->c_qa_done = ($order->c_qa_reviewed >= $totalChecklistItems && $totalChecklistItems > 0);

            return $order;
        });

        // Get counts for the stat buttons (for current date filter)
        $countQuery = DB::table($table)
            ->where('drawer_name', '!=', '')
            ->whereNotNull('drawer_name');

        if ($dateStr && $dateStr !== 'all') {
            $countQuery->whereDate('created_at', $dateStr);
        }
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
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        if (!Schema::hasTable($mistakeTable)) {
            return response()->json([
                'success' => true,
                'data' => [],
                'teams' => [],
                'checklist_items' => [],
                'summary' => ['total_orders' => 0, 'total_mistakes' => 0],
            ]);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $workerFilter = $request->input('worker');

        // Build base query with date filters
        $baseWhere = function ($q) use ($mistakeTable, $dateFrom, $dateTo, $workerFilter) {
            $q->where("{$mistakeTable}.worker", '!=', '')
              ->whereNotNull("{$mistakeTable}.worker");
            if ($dateFrom) $q->where("{$mistakeTable}.created_at", '>=', $dateFrom);
            if ($dateTo)   $q->where("{$mistakeTable}.created_at", '<=', $dateTo . ' 23:59:59');
            if ($workerFilter) $q->where("{$mistakeTable}.worker", 'like', "%{$workerFilter}%");
        };

        // Get ordered checklist items
        $checklistItems = DB::table('product_checklists')
            ->where('is_active', 1)
            ->orderBy('sort_order')
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

        // Plan count per worker (distinct orders reviewed)
        $planCounts = DB::table($mistakeTable)
            ->where($baseWhere)
            ->selectRaw("worker, COUNT(DISTINCT order_id) as plan_count")
            ->groupBy('worker')
            ->pluck('plan_count', 'worker')
            ->toArray();

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

        return response()->json([
            'success' => true,
            'layer' => $layer,
            'teams' => $teams,
            'checklist_items' => $checklistItems,
            'data' => $details, // keep backward compat
            'summary' => [
                'total_orders' => $totalOrders,
                'total_mistakes' => $totalMistakes,
            ],
        ]);
    }

    /**
     * GET /api/live-qa/stats/{projectId}
     *
     * Get Live QA statistics for a project.
     */
    public function stats(Request $request, int $projectId)
    {
        $layer = $request->input('layer', 'drawer');
        $mistakeTable = ProjectOrderService::getMistakeTableName($projectId, $layer);

        if (!Schema::hasTable($mistakeTable)) {
            return response()->json([
                'success' => true,
                'total_reviews' => 0,
                'total_mistakes' => 0,
                'orders_reviewed' => 0,
                'worker_stats' => [],
                'checklist_stats' => [],
            ]);
        }

        $totalReviews = DB::table($mistakeTable)->count();
        $totalMistakes = DB::table($mistakeTable)->where('count_value', '>', 0)->sum('count_value');
        $ordersReviewed = DB::table($mistakeTable)->distinct('order_id')->count('order_id');

        // Mistakes per worker
        $workerStats = DB::table($mistakeTable)
            ->where('worker', '!=', '')
            ->whereNotNull('worker')
            ->selectRaw('worker, COUNT(DISTINCT order_id) as orders_checked, SUM(count_value) as total_mistakes')
            ->groupBy('worker')
            ->orderByDesc('total_mistakes')
            ->limit(50)
            ->get();

        // Mistakes per checklist item
        $checklistStats = DB::table($mistakeTable)
            ->join('product_checklists', 'product_checklists.id', '=', "{$mistakeTable}.product_checklist_id")
            ->selectRaw("product_checklists.title, SUM({$mistakeTable}.count_value) as total_mistakes, COUNT(DISTINCT {$mistakeTable}.order_id) as orders_affected")
            ->groupBy('product_checklists.title')
            ->orderByDesc('total_mistakes')
            ->get();

        return response()->json([
            'success' => true,
            'layer' => $layer,
            'total_reviews' => $totalReviews,
            'total_mistakes' => $totalMistakes,
            'orders_reviewed' => $ordersReviewed,
            'worker_stats' => $workerStats,
            'checklist_stats' => $checklistStats,
        ]);
    }
}
