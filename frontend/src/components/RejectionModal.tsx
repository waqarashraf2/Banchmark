import { useState } from 'react';
import { workflowService } from '../services';
import { 
  AlertTriangle, Loader2, X, Send, 
  AlertCircle, FileX, RefreshCcw, HelpCircle, FileText, Info
} from 'lucide-react';

interface RejectionModalProps {
  orderId: number;
  orderNumber: string;
  onReject: () => void;
  onClose: () => void;
}

const rejectionTypes = [
  { 
    value: 'quality', 
    label: 'Quality Issue', 
    description: 'Output does not meet quality standards',
    icon: AlertCircle,
    color: 'from-rose-500 to-red-600'
  },
  { 
    value: 'incomplete', 
    label: 'Incomplete', 
    description: 'Work is not fully completed',
    icon: FileX,
    color: 'from-amber-500 to-orange-600'
  },
  { 
    value: 'wrong_specs', 
    label: 'Wrong Specifications', 
    description: 'Does not match the requirements',
    icon: HelpCircle,
    color: 'from-brand-500 to-brand-600'
  },
  { 
    value: 'rework', 
    label: 'Needs Rework', 
    description: 'Requires corrections or adjustments',
    icon: RefreshCcw,
    color: 'from-brand-500 to-brand-600'
  },
  { 
    value: 'formatting', 
    label: 'Formatting Issue', 
    description: 'Layout or formatting does not comply with standards',
    icon: FileText,
    color: 'from-violet-500 to-purple-600'
  },
  { 
    value: 'missing_info', 
    label: 'Missing Information', 
    description: 'Required information is absent or incomplete',
    icon: Info,
    color: 'from-sky-500 to-blue-600'
  },
];

const RejectionModal = ({ orderId, orderNumber, onReject, onClose }: RejectionModalProps) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedType || !reason.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await workflowService.rejectOrder(orderId, reason.trim(), selectedType);
      onReject();
    } catch (error: any) {
      console.error('Failed to reject order:', error);
      setError(error.response?.data?.message || 'Failed to reject order');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedType && reason.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <button
            onClick={onClose}
            aria-label="Close rejection dialog"
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reject Order</h2>
              <p className="text-sm text-slate-500">{orderNumber}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rejection Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Rejection Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {rejectionTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-rose-400 bg-rose-50'
                        : 'border-slate-200 hover:border-brand-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${type.color} w-fit mb-2`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <p className={`font-medium ${isSelected ? 'text-rose-700' : 'text-slate-900'}`}>
                      {type.label}
                    </p>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-rose-600' : 'text-slate-500'}`}>
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Detailed Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain what needs to be fixed or corrected (minimum 10 characters)..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {reason.length}/10 characters minimum
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                canSubmit
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Send Back for Rework
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectionModal;
