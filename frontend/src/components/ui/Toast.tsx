// Placeholder for Toast - simplified for now
import { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ type, title, description, duration = 5000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, title, description, duration }]);
    setTimeout(() => dismiss(id), duration);
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none p-4 sm:p-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="pointer-events-auto bg-white rounded-lg shadow-lg border border-slate-200 p-4 flex gap-3 relative overflow-hidden"
            >
              <div className={`p-2 rounded-full shrink-0 ${
                t.type === 'success' ? 'bg-brand-100 text-brand-600' :
                t.type === 'error' ? 'bg-rose-100 text-rose-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {t.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                 t.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                 <Info className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-sm font-medium text-slate-900 leading-tight">{t.title}</h4>
                {t.description && (
                  <p className="text-sm text-slate-500 mt-1 leading-normal">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
