import { useState, useEffect, useRef } from 'react';
import type { Order } from '../types';
import { REJECTION_CODES } from '../types';
import { workflowService } from '../services';
import { Button, Textarea, Select } from './ui';
import { Eye, Clock, X, Flag, HelpCircle, CheckCircle2, Circle, Send, MessageSquare, History } from 'lucide-react';

interface QAWorkFormProps {
  order: Order;
  onComplete: () => void;
  onClose: () => void;
}

interface OrderDetails {
  order: Order;
  supervisor_notes: string | null;
  attachments: Array<{ name: string; url: string; type: string }>;
  help_requests: any[];
  issue_flags: any[];
  current_time_seconds: number;
  timer_running: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'dimensions', label: 'Dimensions & Measurements', description: 'All dimensions match source data accurately', checked: false },
  { id: 'format', label: 'File Format & Quality', description: 'Output meets required format, resolution, and quality standards', checked: false },
  { id: 'specifications', label: 'Client Specifications', description: 'Work follows all client-specific requirements and standards', checked: false },
  { id: 'corrections', label: 'Previous Corrections Applied', description: 'All corrections from previous stages have been properly addressed', checked: false },
  { id: 'labeling', label: 'Labeling & Annotations', description: 'All labels, text, and annotations are correct and properly placed', checked: false },
  { id: 'completeness', label: 'Completeness Check', description: 'No missing elements — all required items present', checked: false },
];

export default function QAWorkForm({ order, onComplete, onClose }: QAWorkFormProps) {
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST.map(c => ({ ...c })));
  const [notes, setNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCode, setRejectCode] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [activeTab, setActiveTab] = useState<'checklist' | 'notes' | 'history'>('checklist');
  const [showFlag, setShowFlag] = useState(false);
  const [flagType, setFlagType] = useState('quality_issue');
  const [flagDescription, setFlagDescription] = useState('');
  const [flagSeverity, setFlagSeverity] = useState('medium');
  const [showHelp, setShowHelp] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState('');

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDetails();
    workflowService.startTimer(order.id).catch(() => {});
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [order.id]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const loadDetails = async () => {
    try {
      const res = await workflowService.orderFullDetails(order.id);
      setDetails(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleTimer = async () => {
    try {
      if (timerRunning) {
        await workflowService.stopTimer(order.id);
      } else {
        await workflowService.startTimer(order.id);
      }
      setTimerRunning(!timerRunning);
    } catch (e) { console.error(e); }
  };

  const allChecked = checklist.every(c => c.checked);
  const checkedCount = checklist.filter(c => c.checked).length;

  const handleApprove = async () => {
    if (!allChecked) return;
    setSubmitting(true);
    try {
      const checklistSummary = checklist.map(c => `✓ ${c.label}`).join('\n');
      const comment = `QA Approved\n\nChecklist:\n${checklistSummary}${notes ? `\n\nNotes: ${notes}` : ''}`;
      await workflowService.submitWork(order.id, comment);
      onComplete();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectCode || !rejectReason || rejectReason.length < 10) return;
    setSubmitting(true);
    try {
      await workflowService.rejectOrder(order.id, rejectReason, rejectCode, routeTo || undefined);
      onComplete();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleFlag = async () => {
    if (!flagDescription) return;
    try {
      await workflowService.flagIssue(order.id, flagType, flagDescription, flagSeverity);
      setShowFlag(false);
      setFlagDescription('');
    } catch (e) { console.error(e); }
  };

  const handleHelp = async () => {
    if (!helpQuestion) return;
    try {
      await workflowService.requestHelp(order.id, helpQuestion);
      setShowHelp(false);
      setHelpQuestion('');
    } catch (e) { console.error(e); }
  };

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const formatTime = (raw: number) => {
    const s = Math.max(0, Math.floor(raw));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : `${m}m ${s % 60}s`;
  };

  const metadata = (order.metadata || {}) as Record<string, string>;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Eye className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">QA Review</h2>
              <p className="text-xs text-slate-500">{order.order_number} · {metadata.address || order.client_reference || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Timer */}
            <button
              onClick={toggleTimer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                timerRunning ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatTime(elapsed)}
            </button>
            <button onClick={onClose} title="Close" className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100">
          <button
            onClick={() => setShowFlag(!showFlag)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Flag className="h-3.5 w-3.5" /> Flag Issue
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Request Help
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Checklist:</span>
            <span className={`text-xs font-semibold ${allChecked ? 'text-emerald-600' : 'text-amber-600'}`}>
              {checkedCount}/{checklist.length}
            </span>
          </div>
        </div>

        {/* Flag Panel */}
        {showFlag && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 space-y-2">
            <div className="flex gap-2">
              <Select id="flag-type" value={flagType} onChange={e => setFlagType(e.target.value)} className="text-xs flex-1">
                <option value="quality_issue">Quality Issue</option>
                <option value="missing_data">Missing Data</option>
                <option value="client_specs">Client Spec Issue</option>
              </Select>
              <Select id="flag-sev" value={flagSeverity} onChange={e => setFlagSeverity(e.target.value)} className="text-xs">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs rounded-lg border border-amber-200 px-3 py-1.5 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Describe the issue..."
                value={flagDescription}
                onChange={e => setFlagDescription(e.target.value)}
              />
              <Button size="sm" onClick={handleFlag} disabled={!flagDescription}>Submit</Button>
            </div>
          </div>
        )}

        {/* Help Panel */}
        {showHelp && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs rounded-lg border border-blue-200 px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                placeholder="What do you need help with?"
                value={helpQuestion}
                onChange={e => setHelpQuestion(e.target.value)}
              />
              <Button size="sm" onClick={handleHelp} disabled={!helpQuestion}>Ask</Button>
            </div>
          </div>
        )}

        {/* Order Info */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400">Priority</span>
              <div className={`font-semibold mt-0.5 ${order.priority === 'urgent' ? 'text-red-600' : order.priority === 'high' ? 'text-amber-600' : 'text-slate-700'}`}>
                {order.priority}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Due Date</span>
              <div className="font-semibold text-slate-700 mt-0.5">{order.due_date ? new Date(order.due_date).toLocaleDateString() : '—'}</div>
            </div>
            <div>
              <span className="text-slate-400">Client Ref</span>
              <div className="font-semibold text-slate-700 mt-0.5">{order.client_reference || '—'}</div>
            </div>
            <div>
              <span className="text-slate-400">Rejection Count</span>
              <div className="font-semibold text-slate-700 mt-0.5">{(order as any).rejection_count ?? 0}</div>
            </div>
          </div>
          {order.rejection_reason && (
            <div className="mt-2 p-2 bg-rose-50 rounded-lg text-xs text-rose-700">
              <span className="font-medium">Previous Rejection:</span> {order.rejection_reason}
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100">
          {[
            { id: 'checklist' as const, label: 'Quality Checklist', icon: CheckCircle2 },
            { id: 'notes' as const, label: 'Notes', icon: MessageSquare },
            { id: 'history' as const, label: 'History', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Checklist Tab */}
              {activeTab === 'checklist' && (
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      className={`w-full flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                        item.checked
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {item.checked ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <div className={`text-sm font-medium ${item.checked ? 'text-emerald-800' : 'text-slate-900'}`}>
                          {item.label}
                        </div>
                        <div className={`text-xs mt-0.5 ${item.checked ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {item.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <Textarea
                    id="qa-notes"
                    label="QA Notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add any observations, special notes, or feedback for the team..."
                    rows={8}
                    showCharCount
                    maxLength={1000}
                    currentLength={notes.length}
                  />
                  {metadata.client_standards && (
                    <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                      <span className="font-medium">Client Standards:</span> {metadata.client_standards}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && details && (
                <div className="space-y-4">
                  {details.help_requests && details.help_requests.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Help Requests</h4>
                      <div className="space-y-2">
                        {details.help_requests.map((hr: any, i: number) => (
                          <div key={i} className="p-3 bg-slate-50 rounded-lg text-xs">
                            <span className="text-slate-700">{hr.question || hr.description || JSON.stringify(hr)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {details.issue_flags && details.issue_flags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Issue Flags</h4>
                      <div className="space-y-1.5">
                        {details.issue_flags.map((flag: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs py-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                            <span className="text-slate-700">{flag.description || JSON.stringify(flag)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {details.supervisor_notes && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Supervisor Notes</h4>
                      <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">{details.supervisor_notes}</div>
                    </div>
                  )}
                  {(!details.help_requests?.length && !details.issue_flags?.length && !details.supervisor_notes) && (
                    <div className="text-center py-8 text-sm text-slate-400">No history available for this order.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Reject Panel */}
        {showReject && (
          <div className="px-6 py-4 border-t border-rose-200 bg-rose-50 space-y-3">
            <h4 className="text-sm font-semibold text-rose-800">Reject Order</h4>
            <Select
              id="reject-code"
              label="Rejection Code"
              required
              value={rejectCode}
              onChange={e => setRejectCode(e.target.value)}
            >
              <option value="">Select reason code...</option>
              {REJECTION_CODES.map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </Select>
            <Textarea
              id="reject-reason"
              label="Issue Details"
              required
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Describe the issue in detail (minimum 10 characters)..."
              rows={3}
              showCharCount
              maxLength={500}
              currentLength={rejectReason.length}
            />
            <Select
              id="route-to"
              label="Route to"
              value={routeTo}
              onChange={e => setRouteTo(e.target.value)}
              hint="Leave as Auto to route to the previous stage"
            >
              <option value="">Auto (previous stage)</option>
              <option value="draw">Drawing Stage</option>
              <option value="check">Checking Stage</option>
            </Select>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowReject(false)} className="flex-1">Cancel</Button>
              <Button
                variant="danger"
                onClick={handleReject}
                loading={submitting}
                disabled={!rejectCode || !rejectReason || rejectReason.length < 10}
                className="flex-1"
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!showReject && (
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center gap-3">
            <Button
              variant="danger"
              onClick={() => setShowReject(true)}
              icon={<X className="h-4 w-4" />}
              className="flex-1"
            >
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              loading={submitting}
              disabled={!allChecked}
              icon={<Send className="h-4 w-4" />}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30"
            >
              {allChecked ? 'Approve & Deliver' : `Complete Checklist (${checkedCount}/${checklist.length})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
