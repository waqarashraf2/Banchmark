import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, Clock, AlertTriangle, Package, UserX, FileText, Lock, RotateCcw, UserMinus } from 'lucide-react';
import type { RootState, AppDispatch } from '../../store/store';
import type { Notification, NotificationType } from '../../types';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../../store/slices/notificationSlice';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  order_assigned:     { icon: Package,        color: 'text-brand-600',   bg: 'bg-brand-50'   },
  work_submitted:     { icon: Check,          color: 'text-brand-600',   bg: 'bg-brand-50'   },
  order_rejected:     { icon: AlertTriangle,  color: 'text-red-600',     bg: 'bg-red-50'     },  order_returned:     { icon: RotateCcw,      color: 'text-orange-600',  bg: 'bg-orange-50'  },  order_received:     { icon: Package,        color: 'text-blue-600',    bg: 'bg-blue-50'    },
  order_on_hold:      { icon: Clock,          color: 'text-amber-600',   bg: 'bg-amber-50'   },
  order_resumed:      { icon: Check,          color: 'text-brand-600',   bg: 'bg-brand-50'   },
  order_delivered:    { icon: CheckCheck,      color: 'text-brand-600',  bg: 'bg-brand-50'   },
  user_deactivated:   { icon: UserX,          color: 'text-red-600',     bg: 'bg-red-50'     },
  force_logout:       { icon: UserX,          color: 'text-red-600',     bg: 'bg-red-50'     },
  invoice_transition: { icon: FileText,       color: 'text-brand-600',   bg: 'bg-brand-50'   },
  month_locked:       { icon: Lock,           color: 'text-slate-600',   bg: 'bg-slate-100'  },
  worker_inactive:    { icon: UserMinus,      color: 'text-amber-600',   bg: 'bg-amber-50'   },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, unreadCount, loading, hasMore, page } = useSelector((s: RootState) => s.notifications);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(prev => !prev);
    if (!open) {
      dispatch(fetchNotifications(1));
    }
  }, [open, dispatch]);

  const handleMarkRead = (n: Notification) => {
    if (!n.read_at) dispatch(markAsRead(n.id));
    if (n.action_url) {
      navigate(n.action_url);
      setOpen(false);
    }
  };

  const handleMarkAll = () => {
    dispatch(markAllAsRead());
  };

  const handleDelete = (id: number) => {
    dispatch(deleteNotification(id));
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      dispatch(fetchNotifications(page + 1));
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden z-[60]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {items.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No notifications yet</p>
                </div>
              )}

              {items.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.order_assigned;
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkRead(n)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                      !n.read_at ? 'bg-teal-50/30' : ''
                    }`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.read_at ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                          {n.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          className="shrink-0 p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                          title="Delete notification"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read_at && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="py-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                </div>
              )}

              {hasMore && items.length > 0 && !loading && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 text-xs text-teal-600 hover:text-teal-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  Load more
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
