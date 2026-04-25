import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { invoiceService, projectService } from '../../services';
import type { Invoice, InvoiceStatus } from '../../types';
import { AnimatedPage, PageHeader, StatusBadge, Modal, Button, DataTable, FilterBar } from '../../components/ui';
import { FileText, Plus, Eye, ChevronRight, DollarSign, TrendingUp } from 'lucide-react';

const INVOICE_FLOW: InvoiceStatus[] = ['draft', 'prepared', 'approved', 'issued', 'sent'];

const STATUS_ACTIONS: Record<string, { next: InvoiceStatus; label: string; roles: string[] }> = {
  draft: { next: 'prepared', label: 'Mark Prepared', roles: ['ceo', 'director', 'operations_manager', 'accounts_manager'] },
  prepared: { next: 'approved', label: 'Approve', roles: ['ceo', 'director'] },
  approved: { next: 'issued', label: 'Issue', roles: ['ceo', 'director'] },
  issued: { next: 'sent', label: 'Mark Sent', roles: ['ceo', 'director'] },
};

const now = new Date();

export default function InvoiceManagement() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Invoice | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({ invoice_number: '', project_id: '', month: String(now.getMonth() + 1), year: String(now.getFullYear()), total_amount: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { loadInvoices(); }, [selectedStatus]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      const res = await invoiceService.list(params);
      const list = res.data?.data || res.data;
      setInvoices(Array.isArray(list) ? list : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleTransition = async (id: number, toStatus: InvoiceStatus) => {
    try {
      await invoiceService.transition(id, toStatus);
      loadInvoices();
      if (showDetail?.id === id) setShowDetail(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this draft invoice?')) return;
    try { await invoiceService.delete(id); loadInvoices(); if (showDetail?.id === id) setShowDetail(null); }
    catch (e) { console.error(e); }
  };

  const openCreate = async () => {
    setFormData({ invoice_number: '', project_id: '', month: String(now.getMonth() + 1), year: String(now.getFullYear()), total_amount: '' });
    setFormError('');
    try { const res = await projectService.list(); const d = res.data?.data || res.data; setProjects(Array.isArray(d) ? d : []); } catch (_) {}
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!formData.invoice_number || !formData.project_id) { setFormError('Invoice number and project are required.'); return; }
    try {
      setSaving(true); setFormError('');
      await invoiceService.create({ invoice_number: formData.invoice_number, project_id: Number(formData.project_id), month: formData.month, year: formData.year, total_amount: formData.total_amount ? Number(formData.total_amount) : undefined });
      setShowCreate(false); loadInvoices();
    } catch (e: any) { setFormError(e.response?.data?.message || 'Failed to create.'); }
    finally { setSaving(false); }
  };

  const canCreate = ['ceo', 'director', 'operations_manager'].includes(user?.role || '');
  const filtered = invoices.filter(inv => !searchTerm || inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalAmount = filtered.reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);

  return (
    <AnimatedPage>
      <PageHeader
        title="Invoices"
        subtitle="Draft → Prepared → Approved → Issued → Sent"
        actions={canCreate ? <Button onClick={openCreate} icon={Plus}>New Invoice</Button> : undefined}
      />

      {/* Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-4 mb-6">
        <div className="flex items-center justify-between">
          {INVOICE_FLOW.map((status, i) => {
            const count = invoices.filter(inv => inv.status === status).length;
            const active = selectedStatus === status;
            return (
              <div key={status} className="flex items-center">
                <button
                  onClick={() => setSelectedStatus(active ? 'all' : status)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg transition-all ${active ? 'bg-[#2AA7A0] text-white' : 'hover:bg-slate-50'}`}
                >
                  <span className={`text-[11px] uppercase font-medium tracking-wide ${active ? 'text-slate-300' : 'text-slate-400'}`}>{status}</span>
                  <span className={`text-xl font-bold mt-0.5 ${active ? 'text-white' : 'text-slate-900'}`}>{count}</span>
                </button>
                {i < INVOICE_FLOW.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><FileText className="w-5 h-5 text-slate-600" /></div>
          <div><div className="text-2xl font-bold text-slate-900">{filtered.length}</div><div className="text-xs text-slate-500">Total Invoices</div></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-brand-600" /></div>
          <div><div className="text-2xl font-bold text-slate-900">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="text-xs text-slate-500">Total Amount</div></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
          <div><div className="text-sm font-semibold text-slate-900 capitalize">{selectedStatus === 'all' ? 'All Statuses' : selectedStatus}</div><div className="text-xs text-slate-500">Current Filter</div></div>
        </div>
      </div>

      {/* Filter */}
      <FilterBar searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Search invoices..."
        filters={<select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} aria-label="Filter by status" className="select text-sm">
          <option value="all">All Status</option>
          {INVOICE_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
        </select>}
      />

      {/* Table */}
      <div className="mt-4">
        <DataTable
          data={filtered}
          loading={loading}
          columns={[
            { key: 'invoice_number', label: 'Invoice #', sortable: true, render: (inv) => <span className="font-semibold text-slate-900">{inv.invoice_number}</span> },
            { key: 'status', label: 'Status', render: (inv) => <StatusBadge status={inv.status} /> },
            { key: 'total_amount', label: 'Amount', sortable: true, render: (inv) => <span className="font-medium">${(Number(inv.total_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
            { key: 'month', label: 'Period', render: (inv) => <span className="text-slate-500">{inv.month}/{inv.year}</span> },
            { key: 'project', label: 'Project', render: (inv) => <span className="text-slate-500">{inv.project?.name || '—'}</span> },
            { key: 'actions', label: '', render: (inv) => {
              const action = STATUS_ACTIONS[inv.status];
              const canAct = action && action.roles.includes(user?.role || '');
              return (
                <div className="flex items-center gap-1.5 justify-end">
                  <Button variant="ghost" size="xs" onClick={() => setShowDetail(inv)}><Eye className="w-3.5 h-3.5" /></Button>
                  {canAct && <Button size="xs" onClick={() => handleTransition(inv.id, action.next)}>{action.label}</Button>}
                  {inv.status === 'draft' && canCreate && <Button variant="danger" size="xs" onClick={() => handleDelete(inv.id)}>Delete</Button>}
                </div>
              );
            }},
          ]}
          emptyIcon={FileText}
          emptyTitle="No invoices found"
          emptyDescription="Create your first invoice to get started."
        />
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" subtitle="New invoices start in Draft status">
        {formError && <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">{formError}</div>}
        <div className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Invoice Number <span className="text-rose-500">*</span></label>
            <input type="text" value={formData.invoice_number} onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" placeholder="INV-001" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Project <span className="text-rose-500">*</span></label>
            <select value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })} aria-label="Select project" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors appearance-none cursor-pointer">
              <option value="">Select project...</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Month</label>
              <select value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })} aria-label="Invoice month" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors appearance-none cursor-pointer">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Year</label>
              <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} aria-label="Invoice year" placeholder="2026" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Amount</label>
              <input type="number" step="0.01" value={formData.total_amount} onChange={e => setFormData({ ...formData, total_amount: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" placeholder="0.00" />
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button className="flex-1" onClick={handleCreate} loading={saving}>Create Draft</Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Invoice Details" size="md">
        {showDetail && (
          <>
            {/* Progress pipeline */}
            <div className="flex items-center gap-1 mb-6">
              {INVOICE_FLOW.map((s, i) => {
                const idx = INVOICE_FLOW.indexOf(showDetail.status as InvoiceStatus);
                const isDone = i <= idx;
                const isCurrent = s === showDetail.status;
                return (
                  <div key={s} className="flex-1 flex flex-col items-center">
                    <div className={`w-full h-1.5 rounded-full ${isDone ? 'bg-[#2AA7A0]' : 'bg-slate-200'}`} />
                    <span className={`text-[11px] mt-1 ${isCurrent ? 'font-bold text-slate-900' : 'text-slate-400'}`}>{s}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {[
                { label: 'Invoice #', value: showDetail.invoice_number },
                { label: 'Status', value: showDetail.status },
                { label: 'Amount', value: `$${(Number(showDetail.total_amount) || 0).toFixed(2)}` },
                { label: 'Period', value: `${showDetail.month}/${showDetail.year}` },
                { label: 'Approved By', value: showDetail.approvedBy?.name || '—' },
                { label: 'Issued By', value: showDetail.issuedBy?.name || '—' },
                { label: 'Sent At', value: showDetail.sent_at ? new Date(showDetail.sent_at).toLocaleString() : '—' },
                { label: 'Created', value: new Date(showDetail.created_at).toLocaleString() },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-500">{item.label}</span>
                  <span className="text-sm font-medium text-slate-900 capitalize">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDetail(null)}>Close</Button>
              {(() => {
                const action = STATUS_ACTIONS[showDetail.status];
                if (!action || !action.roles.includes(user?.role || '')) return null;
                return <Button className="flex-1" onClick={() => handleTransition(showDetail.id, action.next)}>{action.label}</Button>;
              })()}
            </div>
          </>
        )}
      </Modal>
    </AnimatedPage>
  );
}
