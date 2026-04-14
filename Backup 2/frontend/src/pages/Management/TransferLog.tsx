import { useEffect, useState, useCallback } from 'react';
import { auditLogService } from '../../services';
import type { AuditLogEntry } from '../../services';
import { AnimatedPage, PageHeader, Button, EmptyState } from '../../components/ui';
import {
  ScrollText, RefreshCw, ChevronLeft, ChevronRight, Filter,
  ArrowRightLeft, User, FolderKanban, Search, Calendar, X,
} from 'lucide-react';

// Comprehensive action labels covering ALL logged operations
const ACTION_LABELS: Record<string, { label: string; color: string; category: string }> = {
  // User operations
  USER_CREATED:           { label: 'User Created',           color: 'bg-green-100 text-green-800',  category: 'Users' },
  USER_UPDATED:           { label: 'User Updated',           color: 'bg-blue-100 text-blue-800',    category: 'Users' },
  USER_DEACTIVATED:       { label: 'User Deactivated',       color: 'bg-red-100 text-red-800',      category: 'Users' },
  USER_DELETED:           { label: 'User Deleted',           color: 'bg-red-100 text-red-800',      category: 'Users' },
  // Assignment operations
  PM_PROJECT_ASSIGNED:    { label: 'PM Project Assigned',    color: 'bg-indigo-100 text-indigo-800', category: 'Assignments' },
  OM_PROJECT_ASSIGNED:    { label: 'OM Project Assigned',    color: 'bg-purple-100 text-purple-800', category: 'Assignments' },
  RESOURCE_PROJECT_SWITCH:{ label: 'Resource Project Switch', color: 'bg-amber-100 text-amber-800', category: 'Assignments' },
  ORDER_REASSIGNED:       { label: 'Order Reassigned',       color: 'bg-orange-100 text-orange-800', category: 'Assignments' },
  QA_ASSIGNED:            { label: 'QA Assigned',            color: 'bg-teal-100 text-teal-800',    category: 'Assignments' },
  ASSIGN:                 { label: 'Order Assigned',         color: 'bg-cyan-100 text-cyan-800',    category: 'Assignments' },
  assign_to_qa:           { label: 'Assigned to QA',         color: 'bg-teal-100 text-teal-800',    category: 'Assignments' },
  assign_to_drawer:       { label: 'Assigned to Drawer',     color: 'bg-cyan-100 text-cyan-800',    category: 'Assignments' },
  reassigned_work:        { label: 'Work Reassigned',        color: 'bg-orange-100 text-orange-800', category: 'Assignments' },
  // Project operations
  PROJECT_CREATED:        { label: 'Project Created',        color: 'bg-green-100 text-green-800',  category: 'Projects' },
  PROJECT_UPDATED:        { label: 'Project Updated',        color: 'bg-blue-100 text-blue-800',    category: 'Projects' },
  PROJECT_DELETED:        { label: 'Project Deleted',        color: 'bg-red-100 text-red-800',      category: 'Projects' },
  // Auth operations
  LOGIN:                  { label: 'Login',                  color: 'bg-emerald-100 text-emerald-800', category: 'Auth' },
  LOGIN_FAILED:           { label: 'Login Failed',           color: 'bg-red-100 text-red-800',      category: 'Auth' },
  LOGOUT:                 { label: 'Logout',                 color: 'bg-gray-100 text-gray-700',    category: 'Auth' },
  FORCE_LOGOUT:           { label: 'Force Logout',           color: 'bg-red-100 text-red-800',      category: 'Auth' },
  SESSION_FORCE_INVALIDATED: { label: 'Session Invalidated', color: 'bg-yellow-100 text-yellow-800', category: 'Auth' },
  // Invoice/Finance
  INVOICE_CREATED:        { label: 'Invoice Created',        color: 'bg-green-100 text-green-800',  category: 'Finance' },
  INVOICE_APPROVED:       { label: 'Invoice Approved',       color: 'bg-emerald-100 text-emerald-800', category: 'Finance' },
  INVOICE_REJECTED:       { label: 'Invoice Rejected',       color: 'bg-red-100 text-red-800',      category: 'Finance' },
  INVOICE_DELETED:        { label: 'Invoice Deleted',        color: 'bg-red-100 text-red-800',      category: 'Finance' },
  LOCK_MONTH:             { label: 'Month Locked',           color: 'bg-yellow-100 text-yellow-800', category: 'Finance' },
  UNLOCK_MONTH:           { label: 'Month Unlocked',         color: 'bg-yellow-100 text-yellow-800', category: 'Finance' },
  // Workflow
  order_released:         { label: 'Order Released',         color: 'bg-amber-100 text-amber-800',  category: 'Workflow' },
  ORDER_IMPORT:           { label: 'Orders Imported',        color: 'bg-blue-100 text-blue-800',    category: 'Workflow' },
  CLEAR_PANEL:            { label: 'Panel Cleared',          color: 'bg-gray-100 text-gray-700',    category: 'Workflow' },
  UPDATE_SERVICE_COUNTS:  { label: 'Service Counts Updated', color: 'bg-blue-100 text-blue-800',    category: 'Workflow' },
  // System
  FLAG_INACTIVE:          { label: 'Flagged Inactive',       color: 'bg-yellow-100 text-yellow-800', category: 'System' },
  AUTO_REASSIGN:          { label: 'Auto Reassigned',        color: 'bg-orange-100 text-orange-800', category: 'System' },
  // Legacy ActivityLog actions (lowercase)
  created_user:           { label: 'User Created',           color: 'bg-green-100 text-green-800',  category: 'Users' },
  updated_user:           { label: 'User Updated',           color: 'bg-blue-100 text-blue-800',    category: 'Users' },
  deleted_user:           { label: 'User Deleted',           color: 'bg-red-100 text-red-800',      category: 'Users' },
  deactivated_user:       { label: 'User Deactivated',       color: 'bg-red-100 text-red-800',      category: 'Users' },
  created_project:        { label: 'Project Created',        color: 'bg-green-100 text-green-800',  category: 'Projects' },
  updated_project:        { label: 'Project Updated',        color: 'bg-blue-100 text-blue-800',    category: 'Projects' },
  deleted_project:        { label: 'Project Deleted',        color: 'bg-red-100 text-red-800',      category: 'Projects' },
};

const CATEGORIES = ['All', 'Users', 'Assignments', 'Projects', 'Auth', 'Finance', 'Workflow', 'System'];

// Extended AuditLogEntry with target_user_name from API
interface ExtendedAuditLog extends AuditLogEntry {
  target_user_name?: string;
}

export default function TransferLog() {
  const [logs, setLogs] = useState<ExtendedAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, per_page: 30 };

      // Filter by category -> map to action types
      if (selectedCategory !== 'All') {
        const actions = Object.entries(ACTION_LABELS)
          .filter(([, v]) => v.category === selectedCategory)
          .map(([k]) => k);
        if (actions.length > 0) params.action = actions.join(',');
      }

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const res = await auditLogService.list(params as any);
      const data = res.data as any;
      setLogs(data.data || []);
      setLastPage(data.last_page || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch operational logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, searchQuery, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const renderFieldChanges = (oldVals: Record<string, unknown>, newVals: Record<string, unknown>) => {
    const skipKeys = ['updated_by', 'created_by', 'deleted_by', 'assigned_by', 'switched_by',
                      'reassigned_by', 'deactivated_by', '_note', 'success', 'ip', 'reason',
                      'message', 'user_name'];
    const changes: { field: string; from: unknown; to: unknown }[] = [];

    for (const key of Object.keys(newVals)) {
      if (skipKeys.includes(key)) continue;
      const oldVal = oldVals[key];
      const newVal = newVals[key];
      if (oldVal !== undefined || newVal !== undefined) {
        changes.push({ field: key, from: oldVal, to: newVal });
      }
    }

    if (changes.length === 0) {
      const reason = (newVals as any).reason || (newVals as any).message || (newVals as any)._note;
      if (reason) return <span className="text-xs text-gray-500 italic">{String(reason)}</span>;
      return <span className="text-gray-400 text-xs">—</span>;
    }

    return (
      <div className="space-y-0.5">
        {changes.slice(0, 4).map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 font-medium min-w-[70px]">{formatFieldName(c.field)}:</span>
            {c.from !== undefined && c.from !== null ? (
              <>
                <span className="text-red-600 line-through">{formatValue(c.from)}</span>
                <ArrowRightLeft className="w-3 h-3 text-gray-400 shrink-0" />
              </>
            ) : null}
            <span className="text-green-600 font-medium">{formatValue(c.to)}</span>
          </div>
        ))}
        {changes.length > 4 && <span className="text-[10px] text-gray-400">+{changes.length - 4} more</span>}
      </div>
    );
  };

  const formatFieldName = (field: string) => {
    return field.replace(/_/g, ' ').replace(/\bid\b/g, 'ID').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (Array.isArray(val)) return `[${val.join(', ')}]`;
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const renderChangeDetails = (log: ExtendedAuditLog) => {
    const oldVals = (log.old_values || {}) as Record<string, unknown>;
    const newVals = (log.new_values || {}) as Record<string, unknown>;

    // Assignment-style logs with project_ids arrays
    if (log.action === 'PM_PROJECT_ASSIGNED' || log.action === 'OM_PROJECT_ASSIGNED') {
      const oldIds = (oldVals.project_ids as number[]) || [];
      const newIds = (newVals.project_ids as number[]) || [];
      return (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Projects:</span>
          <span className="font-medium text-red-600">[{oldIds.join(', ') || '—'}]</span>
          <ArrowRightLeft className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="font-medium text-green-600">[{newIds.join(', ') || '—'}]</span>
        </div>
      );
    }

    // Login/logout — show IP
    if (log.action === 'LOGIN' || log.action === 'LOGIN_FAILED' || log.action === 'LOGOUT') {
      const ip = (newVals.ip as string) || log.ip_address;
      return (
        <span className="text-xs text-gray-500">
          {log.action === 'LOGIN_FAILED' && <span className="text-red-600 mr-1">{String(newVals.reason || '')}</span>}
          {ip && <span>IP: {ip}</span>}
        </span>
      );
    }

    // Order assign logs
    if (log.action === 'assign_to_qa' || log.action === 'assign_to_drawer') {
      return <span className="text-xs text-gray-600">{String(newVals.message || '')}</span>;
    }

    // Generic field-level changes
    if (Object.keys(newVals).length > 0 || Object.keys(oldVals).length > 0) {
      return renderFieldChanges(oldVals, newVals);
    }

    return <span className="text-gray-400 text-xs">—</span>;
  };

  const getSubjectText = (log: ExtendedAuditLog) => {
    const modelShort = log.model_type ? log.model_type.split('\\').pop() : '';

    if ((modelShort === 'User' || log.model_type === 'User') && log.target_user_name) {
      return (
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span>{log.target_user_name}</span>
          <span className="text-gray-400">#{log.model_id}</span>
        </div>
      );
    }

    if (modelShort === 'Project' || log.model_type === 'Project') {
      return (
        <div className="flex items-center gap-1.5">
          <FolderKanban className="w-3.5 h-3.5 text-gray-400" />
          <span>Project #{log.model_id}</span>
        </div>
      );
    }

    if (modelShort === 'Order' || log.model_type === 'Order') {
      return (
        <div className="flex items-center gap-1.5">
          <ScrollText className="w-3.5 h-3.5 text-gray-400" />
          <span>Order #{log.model_id}</span>
          {log.project_id && <span className="text-gray-400">(P#{log.project_id})</span>}
        </div>
      );
    }

    return (
      <div className="text-gray-400">
        {modelShort && <span>{modelShort} #{log.model_id}</span>}
      </div>
    );
  };

  const clearFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = selectedCategory !== 'All' || searchQuery || dateFrom || dateTo;

  return (
    <AnimatedPage>
      <div className="space-y-5">
        <PageHeader
          title="Operational Log"
          subtitle={`Complete audit trail — ${total} records`}
          actions={
            <Button onClick={fetchLogs} variant="secondary" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          }
        />

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {/* Search + Date Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions, values..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                aria-label="Date from"
                title="Date from"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                aria-label="Date to"
                title="Date to"
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Clear filters">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading operational logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No logs found"
              description={hasFilters ? 'Try adjusting your filters.' : 'Operational activity will appear here.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[160px]">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[170px]">Performed By</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[160px]">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[160px]">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-xs truncate">{log.user.name}</div>
                              <div className="text-gray-400 text-[10px]">{log.user.role?.replace('_', ' ')}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          ACTION_LABELS[log.action]?.color || 'bg-gray-100 text-gray-700'
                        }`}>
                          {ACTION_LABELS[log.action]?.label || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {getSubjectText(log)}
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        {renderChangeDetails(log)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm text-gray-500">
                Page {page} of {lastPage} ({total} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  aria-label="Next page"
                  className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
