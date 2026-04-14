import { useState, useEffect, useCallback } from 'react';
import { liveQAService } from '../services';
import { Modal, Button } from './ui';
import { ShieldCheck, AlertTriangle, Plus, Minus, Loader2, CheckCircle, MessageSquare, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChecklistItem {
  product_checklist_id: number;
  title: string;
  client: string;
  product: string;
  is_checked: boolean;
  count_value: number;
  text_value: string;
  review_id: number | null;
  created_by: string | null;
  updated_at: string | null;
}

interface ReviewData {
  order_number: string;
  layer: string;
  worker_name: string;
  order: {
    id: number;
    order_number: string;
    address: string;
    drawer_name: string;
    checker_name: string;
    qa_name: string;
    drawer_done: string;
    checker_done: string;
    final_upload: string;
  } | null;
  items: ChecklistItem[];
  total_items: number;
  reviewed_items: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  orderNumber: string;
  layer: string;
  onSaved?: () => void;
}

export default function LiveQAChecklistModal({ open, onClose, projectId, orderNumber, layer, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchReview = useCallback(async () => {
    if (!open || !orderNumber) return;
    setLoading(true);
    setError('');
    try {
      const res = await liveQAService.getReview(projectId, orderNumber, layer);
      const data = res.data;
      setReviewData(data);
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, [open, projectId, orderNumber, layer]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const updateItem = (index: number, field: keyof ChecklistItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const toggleMistake = (index: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newChecked = !item.is_checked;
      return {
        ...item,
        is_checked: newChecked,
        count_value: newChecked ? Math.max(item.count_value, 1) : 0,
      };
    }));
  };

  const incrementCount = (index: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, count_value: item.count_value + 1, is_checked: true };
    }));
  };

  const decrementCount = (index: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newCount = Math.max(0, item.count_value - 1);
      return { ...item, count_value: newCount, is_checked: newCount > 0 };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = items.map(item => ({
        product_checklist_id: item.product_checklist_id,
        is_checked: item.is_checked,
        count_value: item.count_value,
        text_value: item.text_value,
      }));
      const res = await liveQAService.submitReview(projectId, orderNumber, layer, { items: payload });
      setSuccessMsg(res.data.message || 'Review saved successfully');
      onSaved?.();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const totalMistakes = items.reduce((sum, item) => sum + item.count_value, 0);
  const itemsWithMistakes = items.filter(item => item.is_checked).length;

  const layerLabel = layer === 'drawer' ? 'Drawer' : layer === 'checker' ? 'Checker' : 'QA';
  const layerColor = layer === 'drawer' ? 'blue' : layer === 'checker' ? 'amber' : 'rose';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Live QA Review — ${layerLabel}`}
      subtitle={reviewData?.order ? `Order: ${reviewData.order.order_number}` : undefined}
      size="xl"
      icon={ShieldCheck}
      variant="default"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              Mistakes: <span className={`font-bold ${totalMistakes > 0 ? 'text-rose-600' : 'text-brand-600'}`}>{totalMistakes}</span>
            </span>
            <span className="text-slate-500">
              Items flagged: <span className="font-semibold text-slate-700">{itemsWithMistakes}/{items.length}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Review
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : error && !reviewData ? (
        <div className="flex items-center justify-center py-16 text-rose-600">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Order Info Bar */}
          {reviewData?.order && (
            <div className={`bg-${layerColor}-50 border border-${layerColor}-200 rounded-lg p-3`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 text-xs">Order</span>
                  <p className="font-semibold text-slate-800">{reviewData.order.order_number}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Address</span>
                  <p className="font-medium text-slate-700 truncate">{reviewData.order.address || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Worker ({layerLabel})</span>
                  <p className="font-semibold text-slate-800">{reviewData.worker_name || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Status</span>
                  <p className="font-medium text-brand-700">
                    {reviewData.reviewed_items}/{reviewData.total_items} reviewed
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error/Success messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" /> {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" /> {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Checklist Items */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <motion.div
                key={item.product_checklist_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-lg border p-3 transition-all duration-200 ${
                  item.is_checked
                    ? 'bg-rose-50 border-rose-200 ring-1 ring-rose-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Mistake Toggle */}
                  <button
                    onClick={() => toggleMistake(index)}
                    className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      item.is_checked
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {item.is_checked && <AlertTriangle className="h-3.5 w-3.5" />}
                  </button>

                  {/* Item Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${item.is_checked ? 'text-rose-800' : 'text-slate-700'}`}>
                        {item.title}
                      </span>

                      {/* Count Controls */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => decrementCount(index)}
                          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className={`w-8 text-center text-sm font-bold ${
                          item.count_value > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {item.count_value}
                        </span>
                        <button
                          onClick={() => incrementCount(index)}
                          className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Comment Input - only show when mistake is checked */}
                    {item.is_checked && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2"
                      >
                        <div className="relative">
                          <MessageSquare className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={item.text_value}
                            onChange={(e) => updateItem(index, 'text_value', e.target.value)}
                            placeholder="Comment (e.g., Kitchen hobe wrong)"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-slate-400"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Show existing review info */}
                    {item.created_by && item.updated_at && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Reviewed by {item.created_by} · {new Date(item.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <ShieldCheck className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No checklist items configured.</p>
              <p className="text-xs text-slate-400 mt-1">Ask a Director/CEO to add checklist items.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
