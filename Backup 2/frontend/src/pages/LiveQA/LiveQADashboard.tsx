import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { liveQAService, projectService } from '../../services';
import { AnimatedPage, PageHeader, StatCard, Button, Select, Modal, LiveQATableSkeleton, LiveQAStatsSkeleton } from '../../components/ui';
import LiveQAChecklistModal from '../../components/LiveQAChecklistModal';
import {
  ShieldCheck, Search, AlertTriangle, CheckCircle, BarChart3,
  Loader2, FileSearch, Users, ClipboardList, Plus, Pencil, Trash2,
  ChevronLeft, Eye, Calendar, Clock,
  FileText, RefreshCw, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ClockDisplay from '../../components/ClockDisplay';

/* ───── Types ───── */
interface ProjectOption {
  id: number;
  name: string;
  country: string;
  timezone?: string;
}

interface OverviewOrder {
  id: number;
  order_number: string;
  VARIANT_no?: string;
  address?: string;
  client_name?: string;
  priority?: string;
  due_in?: string;
  received_at?: string;
  drawer_name?: string;
  drawer_done?: string;
  drawer_date?: string;
  dassign_time?: string;
  d_live_qa: number;
  d_qa_reviewed: number;
  d_qa_total: number;
  d_qa_done: boolean;
  checker_name?: string;
  checker_done?: string;
  checker_date?: string;
  cassign_time?: string;
  c_live_qa: number;
  c_qa_reviewed: number;
  c_qa_total: number;
  c_qa_done: boolean;
  final_upload?: string;
  amend?: number;
  status?: string;
  workflow_state?: string;
  created_at?: string;
}

interface OverviewCounts {
  today_total: number;
  pending: number;
  completed: number;
  amends: number;
  unassigned?: number;
}

interface Stats {
  total_reviews: number;
  total_mistakes: number;
  orders_reviewed: number;
  worker_stats: Array<{ worker: string; orders_checked: number; total_mistakes: number }>;
  checklist_stats: Array<{ title: string; total_mistakes: number; orders_affected: number }>;
}

interface MistakeWorker {
  name: string;
  plan_count: number;
  items: Record<string, number>;
  mistake_total: number;
}

interface MistakeTeam {
  team_id: number;
  team_name: string;
  workers: MistakeWorker[];
}

interface ChecklistItem {
  id: number;
  title: string;
  client: string;
  product: string;
  check_list_type_id: number;
  is_active: boolean;
  sort_order: number;
}

type ViewTab = 'overview' | 'drawer-report' | 'checker-report' | 'checklists';

/* ───── Helpers ───── */

function timeSince(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/\//g, '-'));
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '0m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getOrderStatus(order: OverviewOrder): { label: string; color: string } {
  if (order.workflow_state?.includes('DELIVER') || order.workflow_state?.includes('COMPLETE') || order.final_upload === 'yes') {
    return { label: 'Delivered', color: 'green' };
  }
  if (Number(order.amend) > 0) return { label: 'Amend', color: 'amber' };
  return { label: 'Process', color: 'rose' };
}

/** Parse due_in → ms remaining (PK timezone). */
function parseDueIn(rawInput: unknown, receivedAtInput?: unknown): number | null {
  const getPkNow = () => {
    const pkStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    return new Date(pkStr).getTime();
  };
  // Safely coerce to string — API may return objects or numbers
  const raw = (rawInput != null && typeof rawInput !== 'object') ? String(rawInput) : null;
  const receivedAt = (receivedAtInput != null && typeof receivedAtInput !== 'object') ? String(receivedAtInput) : null;

  if (raw) {
    let d = new Date(raw);
    if (isNaN(d.getTime())) {
      const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
      if (m) d = new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]);
    }
    if (!isNaN(d.getTime())) return d.getTime() - getPkNow();
  }
  if (receivedAt) {
    const rd = new Date(receivedAt);
    if (!isNaN(rd.getTime())) return (rd.getTime() + 24 * 3600_000) - getPkNow();
  }
  return null;
}

/** Remaining time badge with colour coding */
function RemainingBadge({ dueIn, receivedAt }: { dueIn?: unknown; receivedAt?: unknown }) {
  const ms = parseDueIn(dueIn, receivedAt);
  if (ms === null) return <span className="text-slate-300">—</span>;
  const totalMin = Math.floor(ms / 60000);
  const overdue = totalMin < 0;
  const absTotalMin = Math.abs(totalMin);
  const hrs = Math.floor(absTotalMin / 60);
  const mins = absTotalMin % 60;
  const label = overdue
    ? (hrs > 0 ? `-${hrs}h ${mins}m` : `-${mins}m`)
    : (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
  const cls = overdue
    ? 'bg-red-100 text-red-700'
    : hrs < 1
      ? 'bg-orange-100 text-orange-700'
      : hrs < 4
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-green-100 text-green-700';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${cls}`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function LiveRoleBadge({
  name,
  done,
  color,
  timeLabel,
}: {
  name?: string;
  done: boolean;
  color: string;
  timeLabel?: string;
}) {
  if (!name) {
    return <span className="text-xs text-slate-400 font-medium italic">Waiting</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <div className={`w-5 h-5 rounded-full ${done ? 'bg-green-400' : color} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0`}>
        {done ? '✓' : name.charAt(0).toUpperCase()}
      </div>
      <span className={`text-xs whitespace-nowrap ${done ? 'text-green-700 font-medium' : 'text-slate-800 font-medium'}`}>
        {name}
      </span>
      {done && <span className="text-green-500 text-[10px] font-bold">✓</span>}
      {timeLabel && (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-brand-500 text-white rounded">
          {timeLabel}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function LiveQADashboard() {
  const user = useSelector((state: RootState) => state.auth.user);

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<number>(0);
  // Overview state
  const [orders, setOrders] = useState<OverviewOrder[]>([]);
  const [counts, setCounts] = useState<OverviewCounts>({ today_total: 0, pending: 0, completed: 0, amends: 0, unassigned: 0 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Mistake summary state
  const [mistakeTeams, setMistakeTeams] = useState<MistakeTeam[]>([]);
  const [mistakeChecklistItems, setMistakeChecklistItems] = useState<string[]>([]);
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [mistakeSummary, setMistakeSummary] = useState({ total_orders: 0, total_mistakes: 0 });
  const [mistakeDateFrom, setMistakeDateFrom] = useState('');
  const [mistakeDateTo, setMistakeDateTo] = useState('');
  const [mistakeWorkerFilter, setMistakeWorkerFilter] = useState('');

  // Checklist management
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(false);
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [editingChecklist, setEditingChecklist] = useState<ChecklistItem | null>(null);

  // Review modal
  const [reviewModal, setReviewModal] = useState<{ open: boolean; orderNumber: string; layer: string }>({
    open: false, orderNumber: '', layer: 'drawer',
  });

  // Mistake Summary Modal
  const [mistakeModal, setMistakeModal] = useState<{ open: boolean; layer: string }>({ open: false, layer: 'drawer' });

  // Project timezone
  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const projectTz = selectedProjectData?.timezone || 'Australia/Sydney';

  // Load projects
  useEffect(() => {
    projectService.list({ per_page: 100 } as any).then((res: any) => {
      const data = res.data?.data || res.data || [];
      const mapped = Array.isArray(data)
        ? data.map((p: any) => ({ id: p.id, name: p.name, country: p.country, timezone: p.timezone }))
        : [];
      setProjects(mapped);
      // Default to Metro FP (project 13)
      const metro = mapped.find((p: ProjectOption) => p.id === 13);
      setSelectedProject(metro ? 13 : mapped[0]?.id || 0);
    }).catch(() => {
      // Fallback: even if project list fails, still default to Metro
      setSelectedProject(13);
    });
  }, []);

  /* ─── Data fetchers ─── */

  const fetchOverview = useCallback(async () => {
    if (!selectedProject) return;
    setOrdersLoading(true);
    try {
      const res = await liveQAService.getOverview(selectedProject, {
        per_page: 10000,
        search: orderSearch || undefined,
        date: dateFilter || undefined,
        filter: statusFilter,
      });
      const d = res.data;
      setOrders(d.data || []);
      setCounts(d.counts || { today_total: 0, pending: 0, completed: 0, amends: 0 });
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedProject, orderSearch, dateFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
  }, [fetchOverview, activeTab]);

  const fetchMistakeSummary = useCallback(async (layer: string, dateFrom?: string, dateTo?: string, worker?: string) => {
    if (!selectedProject) return;
    setMistakeLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (worker) params.worker = worker;
      const res = await liveQAService.getMistakeSummary(selectedProject, layer, params);
      setMistakeTeams(res.data.teams || []);
      setMistakeChecklistItems(res.data.checklist_items || []);
      setMistakeSummary(res.data.summary || { total_orders: 0, total_mistakes: 0 });
    } catch {
      setMistakeTeams([]);
    } finally {
      setMistakeLoading(false);
    }
  }, [selectedProject]);

  const fetchChecklists = useCallback(async () => {
    setChecklistsLoading(true);
    try {
      const res = await liveQAService.getChecklists();
      setChecklists(res.data.data || []);
    } catch { setChecklists([]); }
    finally { setChecklistsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'checklists') fetchChecklists();
  }, [fetchChecklists, activeTab]);

  // Fetch report
  const fetchReport = useCallback(async (layer: string) => {
    if (!selectedProject) return;
    setStatsLoading(true);
    try {
      const res = await liveQAService.getStats(selectedProject, layer);
      setStats(res.data);
    } catch { setStats(null); }
    finally { setStatsLoading(false); }
  }, [selectedProject]);

  useEffect(() => {
    if (activeTab === 'drawer-report') fetchReport('drawer');
    if (activeTab === 'checker-report') fetchReport('checker');
  }, [activeTab, fetchReport]);

  /* ─── Handlers ─── */
  const handleSearch = () => fetchOverview();

  const openReview = (orderNumber: string, layer: string) => {
    setReviewModal({ open: true, orderNumber, layer });
  };

  const openMistakeSummary = (layer: string) => {
    setMistakeModal({ open: true, layer });
    setMistakeDateFrom('');
    setMistakeDateTo('');
    setMistakeWorkerFilter('');
    fetchMistakeSummary(layer);
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    try {
      await liveQAService.createChecklist({ title: newChecklistTitle.trim(), check_list_type_id: 1 });
      setNewChecklistTitle('');
      setShowAddChecklist(false);
      fetchChecklists();
    } catch {}
  };

  const handleUpdateChecklist = async () => {
    if (!editingChecklist) return;
    try {
      await liveQAService.updateChecklist(editingChecklist.id, { title: editingChecklist.title });
      setEditingChecklist(null);
      fetchChecklists();
    } catch {}
  };

  const handleDeleteChecklist = async (id: number) => {
    if (!confirm('Deactivate this checklist item?')) return;
    try { await liveQAService.deleteChecklist(id); fetchChecklists(); } catch {}
  };

  const isManager = user?.role === 'ceo' || user?.role === 'director';

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <AnimatedPage>
      {/* ─── Header with Project Time ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5">
        <PageHeader
          title="Live QA Panel"
          subtitle="New Order Entries — Quality Monitoring"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-brand-50 text-brand-700 rounded-full ring-1 ring-brand-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Live QA
            </span>
          }
        />
        <div className="text-right mt-2 sm:mt-0">
          <ClockDisplay timezone={projectTz} className="text-sm font-semibold text-slate-800 font-mono" />
        </div>
      </div>

      {/* ─── Top Action Buttons ─── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Project Selector */}
        <Select
          value={String(selectedProject)}
          onChange={(e) => {
            setSelectedProject(Number(e.target.value));
          }}
          className="min-w-[180px]"
        >
          <option value="0">Select Project</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.country})</option>
          ))}
        </Select>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* Report Buttons */}
        <button
          onClick={() => setActiveTab('drawer-report')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'drawer-report'
              ? 'bg-brand-700 text-white shadow-sm ring-1 ring-brand-800'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          Drawer Report
        </button>
        <button
          onClick={() => openMistakeSummary('drawer')}
          className="px-3 py-1.5 text-xs font-semibold bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-all"
        >
          Drawer Mistake Summary
        </button>
        <button
          onClick={() => setActiveTab('checker-report')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'checker-report'
              ? 'bg-brand-700 text-white shadow-sm ring-1 ring-brand-800'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          Checker Report
        </button>
        <button
          onClick={() => openMistakeSummary('checker')}
          className="px-3 py-1.5 text-xs font-semibold bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-all"
        >
          Checker Mistake Summary
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* Quick filter buttons */}
        <button
          onClick={() => { setStatusFilter('all'); setActiveTab('overview'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'overview' && statusFilter === 'all'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending ({counts.pending})
        </button>
        <button
          onClick={() => { setStatusFilter('unassigned'); setActiveTab('overview'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            statusFilter === 'unassigned' && activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Unassigned ({counts.unassigned ?? 0})
        </button>
        <button
          onClick={() => { setStatusFilter('completed'); setActiveTab('overview'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            statusFilter === 'completed' && activeTab === 'overview'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Completed Orders ({counts.completed})
        </button>
        <button
          onClick={() => { setStatusFilter('amends'); setActiveTab('overview'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            statusFilter === 'amends' && activeTab === 'overview'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Done Amends ({counts.amends})
        </button>

        {isManager && (
          <>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <button
              onClick={() => setActiveTab('checklists')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'checklists'
                  ? 'bg-brand-600 text-white'
                  : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
              }`}
            >
              <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Manage Checklists</span>
            </button>
          </>
        )}

        {/* Refresh */}
        <button
          onClick={() => { if (activeTab === 'overview') fetchOverview(); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ═══ TODAY TOTAL COUNTER ═══ */}
      {activeTab === 'overview' && (
        <div className="bg-brand-50/60 border border-brand-100 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-brand-700">
            Today Total Properties: <span className="text-lg font-bold text-brand-800">{counts.today_total}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-semibold text-red-600">High: {orders.filter(o => (o.priority || '').toLowerCase() === 'high').length}</span>
          <span className="text-sm font-semibold text-slate-600">Normal: {orders.filter(o => !o.priority || (o.priority || '').toLowerCase() === 'normal' || o.priority === '').length}</span>
          {orders.filter(o => (o.priority || '').toLowerCase() === 'rush').length > 0 && (
            <span className="text-sm font-semibold text-purple-600">Rush: {orders.filter(o => (o.priority || '').toLowerCase() === 'rush').length}</span>
          )}
          {orders.filter(o => (o.priority || '').toLowerCase() === 'urgent').length > 0 && (
            <span className="text-sm font-semibold text-orange-600">Urgent: {orders.filter(o => (o.priority || '').toLowerCase() === 'urgent').length}</span>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══ OVERVIEW TAB — Unified Order Table ═══ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div>
          {/* Search & Date Filter */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search order, address, worker..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); }}
                className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                title="Filter by date"
              />
              {dateFilter && (
                <button
                  onClick={() => { setDateFilter(''); }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                  title="Clear date filter (show today)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch}>
              <Search className="h-3.5 w-3.5 mr-1" /> Search
            </Button>
          </div>

          {/* ─── Main Orders Table ─── */}
          <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden shadow-sm">
            {ordersLoading ? (
              <LiveQATableSkeleton />
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileSearch className="h-12 w-12 mb-3" />
                <p className="text-sm font-medium">No orders found</p>
                <p className="text-xs mt-1">
                  {selectedProject ? 'No orders match your filters' : 'Select a project first'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-700 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap">Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap">Order</th>
                        <th className="px-2 py-2.5 text-left font-semibold text-xs whitespace-nowrap">Variant</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Priority</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap">Address</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Drawer</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">D-LiveQA</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Checker</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">C-LiveQA</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Order Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...orders].sort((a, b) => {
                        const pw: Record<string, number> = { rush: 0, urgent: 0, high: 1, normal: 2, low: 3 };
                        return (pw[a.priority || 'normal'] ?? 2) - (pw[b.priority || 'normal'] ?? 2);
                      }).map((order, i) => {
                        const status = getOrderStatus(order);
                        const hasDrawerDone = order.drawer_done === 'yes';
                        const hasCheckerDone = order.checker_done === 'yes';
                        const checkerWaiting = !order.checker_name;
                        const dLiveQaDone = order.d_qa_done;
                        const cLiveQaDone = order.c_qa_done;
                        const delivered = order.workflow_state?.includes('DELIVER') || order.workflow_state?.includes('COMPLETE') || order.final_upload === 'yes';
                        const checklistLayer = hasCheckerDone ? 'checker' : hasDrawerDone ? 'drawer' : null;

                        return (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.015, 0.5) }}
                            className={`border-b border-slate-100 transition-colors ${
                              !hasDrawerDone
                                ? 'bg-amber-50/50'
                                : checkerWaiting
                                ? 'bg-slate-50/40'
                                : 'hover:bg-slate-50/50'
                            }`}
                          >
                            {/* Date + Receive Time */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="text-xs font-medium text-slate-700">
                                {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', {
                                  day: '2-digit', month: 'short'
                                }) : '—'}
                              </div>
                              {order.created_at && (
                                <div className="text-[10px] text-blue-500 flex items-center gap-0.5 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              {order.dassign_time && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {timeSince(order.dassign_time)}
                                </div>
                              )}
                            </td>

                            {/* Order ID */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="text-xs font-semibold text-slate-900">{String(order.order_number || '—')}</div>
                              {Number(order.amend) > 0 && (
                                <span className="text-[10px] text-amber-600 font-medium">AMEND</span>
                              )}
                            </td>

                            {/* Variant */}
                            <td className="px-2 py-2 text-slate-600 whitespace-nowrap text-xs">
                              {String((order as any).VARIANT_no ?? '') || '—'}
                            </td>

                            {/* Client / Priority */}
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                                order.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                order.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                order.priority === 'normal' ? 'bg-slate-100 text-slate-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {String(order.priority || 'Normal')}
                              </span>
                            </td>

                            {/* Address + Remaining Time */}
                            <td className="px-3 py-2">
                              <div className="text-xs text-slate-700 truncate" title={String(order.address || '')}>
                                {String(order.address || '') || '—'}
                              </div>
                              {!(order.workflow_state?.includes('COMPLETE') || order.workflow_state?.includes('DELIVER') || order.final_upload === 'yes') && (
                                <div className="mt-0.5">
                                  <RemainingBadge dueIn={(order as any).due_in} receivedAt={(order as any).received_at || order.created_at} />
                                </div>
                              )}
                            </td>

                            {/* Drawer */}
                            <td className="px-3 py-2 text-center">
                              <LiveRoleBadge
                                name={order.drawer_name}
                                done={hasDrawerDone}
                                color="bg-brand-600"
                                timeLabel={hasDrawerDone ? (timeSince(order.drawer_date) || '0m') : undefined}
                              />
                            </td>

                            {/* D-LiveQA */}
                            <td className="px-3 py-2 text-center">
                              {hasDrawerDone ? (
                                <button
                                  onClick={() => openReview(order.order_number, 'drawer')}
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                    dLiveQaDone
                                      ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                                      : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {dLiveQaDone ? (
                                    <>
                                      <CheckCircle className="h-3 w-3" />
                                      D-LiveQA
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3 w-3" />
                                      Review
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium italic">Waiting</span>
                              )}
                            </td>

                            {/* Checker */}
                            <td className={`px-3 py-2 text-center ${checkerWaiting ? 'bg-slate-50' : ''}`}>
                              <LiveRoleBadge
                                name={order.checker_name}
                                done={hasCheckerDone}
                                color="bg-blue-600"
                                timeLabel={hasCheckerDone ? (timeSince(order.checker_date) || '0m') : undefined}
                              />
                            </td>

                            {/* C-LiveQA */}
                            <td className={`px-3 py-2 text-center ${checkerWaiting ? 'bg-slate-50' : ''}`}>
                              {hasCheckerDone ? (
                                <button
                                  onClick={() => openReview(order.order_number, 'checker')}
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                    cLiveQaDone
                                      ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                                      : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {cLiveQaDone ? (
                                    <>
                                      <CheckCircle className="h-3 w-3" />
                                      C-LiveQA
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-3 w-3" />
                                      Review
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium italic">Waiting</span>
                              )}
                            </td>

                            {/* Order Status */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-md ${
                                  status.color === 'green'
                                    ? 'bg-brand-500 text-white'
                                    : status.color === 'amber'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {delivered && <CheckCircle className="h-3 w-3" />}
                                  {status.label}
                                </span>
                                {checklistLayer && (
                                  <button
                                    onClick={() => openReview(order.order_number, checklistLayer)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 ring-1 ring-slate-200 transition-all"
                                  >
                                    <ClipboardList className="h-3 w-3" />
                                    Checklist
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total count */}
                {orders.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/30">
                    <span className="text-xs text-slate-500">{orders.length} orders</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══ DRAWER REPORT / CHECKER REPORT TAB ═══ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {(activeTab === 'drawer-report' || activeTab === 'checker-report') && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" />
              {activeTab === 'drawer-report' ? 'Drawer' : 'Checker'} Report
            </h3>
            <Button variant="secondary" size="sm" onClick={() => setActiveTab('overview')}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Overview
            </Button>
          </div>

          {statsLoading ? (
            <LiveQAStatsSkeleton />
          ) : !stats ? (
            <div className="text-center py-20 text-slate-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm">No data available</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Orders Reviewed" value={stats.orders_reviewed} icon={FileSearch} color="blue" />
                <StatCard label="Total Mistakes" value={stats.total_mistakes} icon={AlertTriangle} color="rose" />
                <StatCard label="Total Reviews" value={stats.total_reviews} icon={ClipboardList} color="brand" />
              </div>

              {/* Worker Stats */}
              {stats.worker_stats && stats.worker_stats.length > 0 && (
                <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-500" />
                      {activeTab === 'drawer-report' ? 'Drawer' : 'Checker'} — Mistakes by Worker
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-brand-700 text-white">
                          <th className="px-4 py-2 text-left font-semibold text-xs">#</th>
                          <th className="px-4 py-2 text-left font-semibold text-xs">Worker Name</th>
                          <th className="px-4 py-2 text-right font-semibold text-xs">Orders Checked</th>
                          <th className="px-4 py-2 text-right font-semibold text-xs">Total Mistakes</th>
                          <th className="px-4 py-2 text-right font-semibold text-xs">Avg / Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.worker_stats || []).map((ws, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{String(ws.worker ?? '')}</td>
                            <td className="px-4 py-2 text-right text-slate-600">{ws.orders_checked}</td>
                            <td className="px-4 py-2 text-right">
                              <span className={`font-bold ${ws.total_mistakes > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                                {ws.total_mistakes}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">
                              {ws.orders_checked > 0 ? (ws.total_mistakes / ws.orders_checked).toFixed(1) : '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Checklist Item Stats */}
              {stats.checklist_stats && stats.checklist_stats.length > 0 && (
                <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-slate-500" /> Mistakes by Checklist Item
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-brand-700 text-white">
                          <th className="px-4 py-2 text-left font-semibold text-xs">Checklist Item</th>
                          <th className="px-4 py-2 text-right font-semibold text-xs">Total Mistakes</th>
                          <th className="px-4 py-2 text-right font-semibold text-xs">Orders Affected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats.checklist_stats || []).map((cs, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-medium text-slate-800">{String(cs.title ?? '')}</td>
                            <td className="px-4 py-2 text-right">
                              <span className={`font-bold ${cs.total_mistakes > 0 ? 'text-rose-600' : 'text-green-600'}`}>
                                {cs.total_mistakes}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-slate-600">{cs.orders_affected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══ CHECKLISTS TAB (CEO/Director only) ═══ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'checklists' && isManager && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Product Checklist Items
            </h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowAddChecklist(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('overview')}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showAddChecklist && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-4 bg-white rounded-xl ring-1 ring-black/[0.04] p-4"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                    placeholder="Checklist item title (e.g., Missing Elements)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddChecklist}>Add</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setShowAddChecklist(false); setNewChecklistTitle(''); }}>Cancel</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden">
            {checklistsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              </div>
            ) : checklists.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">No checklist items yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-700 text-white">
                    <th className="px-4 py-2 text-left font-semibold text-xs w-8">#</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Title</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Client</th>
                    <th className="px-4 py-2 text-left font-semibold text-xs">Product</th>
                    <th className="px-4 py-2 text-center font-semibold text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((item, i) => (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2">
                        {editingChecklist?.id === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text" value={editingChecklist.title}
                              onChange={(e) => setEditingChecklist({ ...editingChecklist, title: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateChecklist()}
                              className="flex-1 px-2 py-1 text-sm border border-brand-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                              title="Edit checklist title"
                              autoFocus
                            />
                            <button onClick={handleUpdateChecklist} className="text-brand-600 hover:text-brand-700" title="Save"><CheckCircle className="h-4 w-4" /></button>
                            <button onClick={() => setEditingChecklist(null)} className="text-slate-400 hover:text-slate-600" title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (<span className="font-medium text-slate-800">{item.title}</span>)}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{String(item.client ?? '')}</td>
                      <td className="px-4 py-2 text-slate-600">{String(item.product ?? '')}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditingChecklist(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteChecklist(item.id)} className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Deactivate">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ MISTAKE SUMMARY MODAL — TEAM-GROUPED PIVOT ═══ */}
      {mistakeModal.open && (() => {
        const cols = mistakeChecklistItems.length > 0 ? mistakeChecklistItems : [];
        const projectName = projects.find(p => p.id === selectedProject)?.name || 'Project';
        const layerLabel = mistakeModal.layer === 'drawer' ? 'Drawer' : mistakeModal.layer === 'checker' ? 'Checker' : 'QA';

        // Compute grand totals
        const grandPlanCount = mistakeTeams.reduce((s, t) => s + t.workers.reduce((ws, w) => ws + w.plan_count, 0), 0);
        const grandTotals: Record<string, number> = {};
        cols.forEach(c => { grandTotals[c] = 0; });
        let grandMistakeTotal = 0;
        mistakeTeams.forEach(t => t.workers.forEach(w => {
          Object.entries(w.items).forEach(([k, v]) => { grandTotals[k] = (grandTotals[k] || 0) + v; });
          grandMistakeTotal += w.mistake_total;
        }));

        // CSV download
        const downloadCSV = () => {
          const headers = [layerLabel, 'Plan Count', ...cols, 'Mistake Total'];
          const rows: string[][] = [];
          mistakeTeams.forEach(team => {
            rows.push([team.team_name, '', ...cols.map(() => ''), '']);
            team.workers.forEach(w => {
              rows.push([w.name, String(w.plan_count), ...cols.map(c => String(w.items[c] || 0)), String(w.mistake_total)]);
            });
            const teamPlan = team.workers.reduce((s, w) => s + w.plan_count, 0);
            const teamItems = cols.map(c => String(team.workers.reduce((s, w) => s + (w.items[c] || 0), 0)));
            const teamTotal = team.workers.reduce((s, w) => s + w.mistake_total, 0);
            rows.push([`${team.team_name} TOTAL`, String(teamPlan), ...teamItems, String(teamTotal)]);
          });
          rows.push(['GRAND TOTAL', String(grandPlanCount), ...cols.map(c => String(grandTotals[c] || 0)), String(grandMistakeTotal)]);
          const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${layerLabel}_Mistake_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <Modal
            open={mistakeModal.open}
            onClose={() => setMistakeModal({ open: false, layer: 'drawer' })}
            title=""
            size="full"
          >
            <div className="p-5 space-y-4">
              {/* Title */}
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-800">
                  F.P. {layerLabel} Checklist Summary ({projectName})
                </h2>
              </div>

              {/* Filters Bar */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Worker</label>
                    <input
                      type="text"
                      value={mistakeWorkerFilter}
                      onChange={e => setMistakeWorkerFilter(e.target.value)}
                      placeholder="Filter by name..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                    />
                  </div>
                  <div className="min-w-[130px]">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
                    <input
                      type="date"
                      value={mistakeDateFrom}
                      onChange={e => setMistakeDateFrom(e.target.value)}
                      title="Date from"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                    />
                  </div>
                  <div className="min-w-[130px]">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
                    <input
                      type="date"
                      value={mistakeDateTo}
                      onChange={e => setMistakeDateTo(e.target.value)}
                      title="Date to"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400"
                    />
                  </div>
                  <button
                    onClick={() => fetchMistakeSummary(mistakeModal.layer, mistakeDateFrom, mistakeDateTo, mistakeWorkerFilter)}
                    className="px-4 py-1.5 text-xs font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" /> Download CSV
                  </button>
                </div>
              </div>

              {/* Report subtitle */}
              {(mistakeDateFrom || mistakeDateTo) && (
                <div className="text-center text-xs text-slate-500 font-medium">
                  {projectName} ({layerLabel} Person) QA Report
                  {mistakeDateFrom && ` From ${mistakeDateFrom}`}
                  {mistakeDateTo && ` To ${mistakeDateTo}`}
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-50 rounded-lg p-3 text-center ring-1 ring-brand-200">
                  <div className="text-2xl font-bold text-brand-700">{mistakeSummary.total_orders}</div>
                  <div className="text-[10px] text-brand-600 font-semibold uppercase">Orders Reviewed</div>
                </div>
                <div className="bg-rose-50 rounded-lg p-3 text-center ring-1 ring-rose-200">
                  <div className="text-2xl font-bold text-rose-700">{mistakeSummary.total_mistakes}</div>
                  <div className="text-[10px] text-rose-600 font-semibold uppercase">Total Mistakes</div>
                </div>
              </div>

              {/* Loading */}
              {mistakeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                </div>
              ) : mistakeTeams.length > 0 && cols.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-xs whitespace-nowrap border-collapse">
                    {/* Header */}
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-700 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold sticky left-0 bg-slate-700 z-20 min-w-[150px] border-r border-slate-600">{layerLabel}</th>
                        <th className="px-3 py-2.5 text-center font-semibold min-w-[70px] border-r border-slate-600">Plan Count</th>
                        {cols.map(item => (
                          <th key={item} className="px-2 py-2.5 text-center font-semibold min-w-[85px] border-r border-slate-600" title={item}>
                            {item}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center font-semibold min-w-[80px] bg-rose-800">Mistake Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mistakeTeams.map((team) => {
                        // Team subtotals
                        const teamPlan = team.workers.reduce((s, w) => s + w.plan_count, 0);
                        const teamItems: Record<string, number> = {};
                        cols.forEach(c => { teamItems[c] = team.workers.reduce((s, w) => s + (w.items[c] || 0), 0); });
                        const teamMistakeTotal = team.workers.reduce((s, w) => s + w.mistake_total, 0);

                        return (
                          <React.Fragment key={team.team_id}>
                            {/* Team header row */}
                            <tr className="bg-slate-800">
                              <td colSpan={cols.length + 3} className="px-3 py-2 font-bold text-white text-xs sticky left-0 bg-slate-800 z-[5]">
                                {String(team.team_name ?? '')}
                              </td>
                            </tr>
                            {/* Worker rows */}
                            {team.workers.map((w, wi) => (
                              <tr key={w.name} className={`border-b border-slate-100 hover:bg-brand-50/30 ${wi % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <td className="px-3 py-1.5 font-medium text-slate-700 sticky left-0 bg-inherit z-[5] border-r border-slate-100">
                                  {String(w.name ?? '')}
                                </td>
                                <td className="px-3 py-1.5 text-center font-semibold text-brand-700 border-r border-slate-100">
                                  {w.plan_count}
                                </td>
                                {cols.map(c => {
                                  const val = w.items[c] || 0;
                                  return (
                                    <td key={c} className="px-2 py-1.5 text-center border-r border-slate-100">
                                      <span className={`font-semibold ${
                                        val === 0 ? 'text-slate-400' : val <= 2 ? 'text-amber-600' : 'text-rose-600 font-bold'
                                      }`}>
                                        {val}
                                      </span>
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-1.5 text-center">
                                  <span className={`inline-flex items-center justify-center min-w-[26px] h-5 rounded text-xs font-bold ${
                                    w.mistake_total === 0 ? 'text-slate-400' : 'text-white bg-rose-500 px-1.5'
                                  }`}>
                                    {w.mistake_total}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {/* Team total row */}
                            <tr className="bg-rose-50 border-b-2 border-slate-200">
                              <td className="px-3 py-1.5 font-bold text-slate-700 text-center sticky left-0 bg-rose-50 z-[5] border-r border-slate-200">
                                {team.team_name} TOTAL
                              </td>
                              <td className="px-3 py-1.5 text-center font-bold text-brand-800 border-r border-slate-200">{teamPlan}</td>
                              {cols.map(c => (
                                <td key={c} className="px-2 py-1.5 text-center font-bold border-r border-slate-200">
                                  <span className={teamItems[c] > 0 ? 'text-rose-600' : 'text-slate-400'}>{teamItems[c]}</span>
                                </td>
                              ))}
                              <td className="px-3 py-1.5 text-center font-bold text-rose-700">{teamMistakeTotal}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    {/* Grand Total footer */}
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-slate-800 text-white font-bold">
                        <td className="px-3 py-2.5 sticky left-0 bg-slate-800 z-20 border-r border-slate-600 text-center">GRAND TOTAL</td>
                        <td className="px-3 py-2.5 text-center border-r border-slate-600">{grandPlanCount}</td>
                        {cols.map(c => (
                          <td key={c} className="px-2 py-2.5 text-center border-r border-slate-600">
                            <span className={grandTotals[c] > 0 ? 'text-rose-300' : 'text-slate-400'}>{grandTotals[c] || 0}</span>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center bg-rose-800">
                          <span className="text-sm">{grandMistakeTotal}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
                  <p className="text-sm font-medium">No mistakes recorded yet</p>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══ REVIEW MODAL ═══ */}
      <LiveQAChecklistModal
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, orderNumber: '', layer: 'drawer' })}
        projectId={selectedProject}
        orderNumber={reviewModal.orderNumber}
        layer={reviewModal.layer}
        onSaved={() => fetchOverview()}
      />
    </AnimatedPage>
  );
}
