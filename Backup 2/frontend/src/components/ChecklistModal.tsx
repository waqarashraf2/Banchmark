import { useEffect, useState } from 'react';
import { checklistService } from '../services';
import type { ChecklistItem } from '../types';
import { 
  CheckCircle, Circle, Loader2, X, AlertTriangle,
  FileCheck, CheckCheck, Minus, Plus
} from 'lucide-react';

interface ChecklistModalProps {
  orderId: number;
  orderNumber: string;
  onComplete: () => void;
  onClose: () => void;
}

const ChecklistModal = ({ orderId, orderNumber, onComplete, onClose }: ChecklistModalProps) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allRequiredCompleted, setAllRequiredCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChecklist();
    
    // Lock body scroll when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [orderId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await checklistService.orderChecklist(orderId);
      const raw = response.data?.data || response.data || [];
      const data: ChecklistItem[] = (Array.isArray(raw) ? raw : []).map((item: any) => ({
        id: item.id,
        template_id: item.checklist_template_id ?? item.template_id ?? item.id,
        title: item.template?.title ?? item.title ?? '',
        is_checked: item.is_checked,
        is_required: item.template?.is_required ?? item.is_required,
        description: item.template?.description ?? item.description,
        mistake_count: item.mistake_count ?? 0,
        notes: item.notes,
        completed_at: item.completed_at,
        completed_by: item.completed_by,
      }));
      setItems(data);
      setAllRequiredCompleted(data.every?.((item: any) => !item.is_required || item.is_checked) ?? false);
    } catch (error: any) {
      console.error('Failed to load checklist:', error);
      setError(error.response?.data?.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (templateId: number, currentValue: boolean) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.template_id === templateId 
        ? { ...item, is_checked: !currentValue }
        : item
    ));

    try {
      const item = items.find(i => i.template_id === templateId);
      const response = await checklistService.updateOrderChecklist(orderId, templateId, {
        is_checked: !currentValue,
        mistake_count: item?.mistake_count ?? 0,
      });
      setAllRequiredCompleted(response.data.all_required_completed);
    } catch (error: any) {
      // Revert on error
      setItems(prev => prev.map(item => 
        item.template_id === templateId 
          ? { ...item, is_checked: currentValue }
          : item
      ));
      console.error('Failed to update checklist item:', error);
    }
  };

  const handleUpdateMistakeCount = async (templateId: number, delta: number) => {
    const item = items.find(i => i.template_id === templateId);
    if (!item) return;
    
    const newCount = Math.max(0, (item.mistake_count ?? 0) + delta);
    
    // Optimistic update
    setItems(prev => prev.map(i => 
      i.template_id === templateId 
        ? { ...i, mistake_count: newCount, is_checked: newCount > 0 ? true : i.is_checked }
        : i
    ));

    try {
      const response = await checklistService.updateOrderChecklist(orderId, templateId, {
        is_checked: newCount > 0 ? true : item.is_checked,
        mistake_count: newCount,
      });
      setAllRequiredCompleted(response.data.all_required_completed);
    } catch (error: any) {
      // Revert on error
      setItems(prev => prev.map(i => 
        i.template_id === templateId 
          ? { ...i, mistake_count: item.mistake_count ?? 0 }
          : i
      ));
      console.error('Failed to update mistake count:', error);
    }
  };

  const handleComplete = async () => {
    if (!allRequiredCompleted) return;
    
    try {
      setSaving(true);
      onComplete();
    } catch (error) {
      console.error('Failed to complete order:', error);
    } finally {
      setSaving(false);
    }
  };

  const completedCount = items.filter(i => i.is_checked).length;
  const requiredCount = items.filter(i => i.is_required).length;
  const completedRequiredCount = items.filter(i => i.is_required && i.is_checked).length;
  const percentage = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const totalMistakes = items.reduce((sum, i) => sum + (i.mistake_count ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close checklist"
            aria-label="Close checklist"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Completion Checklist</h2>
              <p className="text-sm text-slate-500">{orderNumber}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">
                {completedCount} of {items.length} items completed
              </span>
              <span className="text-sm font-bold text-brand-600">{percentage}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {totalMistakes > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Mistakes Found:</span>
                <span className="font-bold text-rose-600">{totalMistakes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-700">{error}</p>
              <button
                onClick={loadChecklist}
                className="mt-3 text-brand-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <CheckCheck className="h-12 w-12 text-brand-500 mx-auto mb-3" />
              <p className="text-slate-700">No checklist items for this order.</p>
              <p className="text-sm text-slate-500 mt-1">You can complete this order directly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.template_id}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    item.is_checked
                      ? 'bg-brand-50 border-brand-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => handleToggleItem(item.template_id, item.is_checked)}
                      className={`mt-0.5 flex-shrink-0 ${item.is_checked ? 'text-brand-600' : 'text-slate-300 hover:text-brand-400'}`}
                    >
                      {item.is_checked ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${item.is_checked ? 'text-brand-800' : 'text-slate-900'}`}>
                          {item.title}
                        </span>
                        {item.is_required && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-600 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className={`text-sm mt-1 ${item.is_checked ? 'text-brand-600' : 'text-slate-500'}`}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    {/* Mistake Count Control */}
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap">Mistakes:</span>
                      <div className="flex items-center bg-slate-100 rounded-lg">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateMistakeCount(item.template_id, -1); }}
                          disabled={(item.mistake_count ?? 0) === 0}
                          className="p-1.5 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Decrease mistake count"
                          aria-label="Decrease mistake count"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className={`w-8 text-center font-semibold text-sm ${(item.mistake_count ?? 0) > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {item.mistake_count ?? 0}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateMistakeCount(item.template_id, 1); }}
                          className="p-1.5 text-slate-500 hover:text-slate-700"
                          title="Increase mistake count"
                          aria-label="Increase mistake count"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          {!allRequiredCompleted && requiredCount > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                {completedRequiredCount} of {requiredCount} required items completed
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={!allRequiredCompleted || saving}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                allRequiredCompleted
                  ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 hover:shadow-xl'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              Complete Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistModal;
