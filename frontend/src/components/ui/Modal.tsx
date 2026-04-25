import React, { Fragment, type ReactNode, useEffect, type ComponentType } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { X, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: ReactNode;
  hideClose?: boolean;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'info';
  icon?: ComponentType<any> | ReactNode;
  loading?: boolean;
  lockScroll?: boolean;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

const variantStyles = {
  default: {
    iconBg: 'bg-gradient-to-br from-[#2AA7A0] to-[#238F89]',
    iconColor: 'text-white',
    icon: Info,
    ring: 'ring-[#2AA7A0]/10',
  },
  danger: {
    iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600',
    iconColor: 'text-white',
    icon: AlertTriangle,
    ring: 'ring-rose-500/10',
  },
  success: {
    iconBg: 'bg-gradient-to-br from-brand-500 to-brand-600',
    iconColor: 'text-white',
    icon: CheckCircle,
    ring: 'ring-brand-500/10',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    iconColor: 'text-white',
    icon: AlertTriangle,
    ring: 'ring-amber-500/10',
  },
  info: {
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    iconColor: 'text-white',
    icon: Info,
    ring: 'ring-blue-500/10',
  },
};

export default function Modal({ 
  open, 
  onClose, 
  title, 
  subtitle, 
  children, 
  size = 'md', 
  footer, 
  hideClose, 
  variant = 'default',
  icon,
  loading,
  lockScroll = true,
}: ModalProps) {
  const variantConfig = variantStyles[variant];
  const IconComponent = icon || variantConfig.icon;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open && lockScroll) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open, lockScroll]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-900/60 backdrop-blur-md" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300 delay-75"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <DialogPanel 
                className={`relative w-full ${sizes[size]} bg-white rounded-2xl shadow-2xl ring-1 ${variantConfig.ring} overflow-hidden transform transition-all`}
              >
                {/* Loading Overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-[#2AA7A0]" />
                      <p className="text-sm font-medium text-slate-600">Processing...</p>
                    </div>
                  </div>
                )}

                {/* Header */}
                {(title || !hideClose) && (
                  <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-slate-100">
                    {(icon != null || variant !== 'default') && (
                      <div className={`flex-shrink-0 p-3 rounded-xl ${variantConfig.iconBg} shadow-lg ${variantConfig.iconBg.replace('from-', 'shadow-').replace('to-', '').replace('gradient-to-br', '').trim()}/20`}>
                        {React.isValidElement(IconComponent)
                          ? IconComponent
                          : React.createElement(IconComponent as ComponentType<any>, { className: `h-6 w-6 ${variantConfig.iconColor}` })
                        }
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {title && (
                        <DialogTitle className="text-lg font-bold text-slate-900">
                          {title}
                        </DialogTitle>
                      )}
                      {subtitle && (
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{subtitle}</p>
                      )}
                    </div>
                    {!hideClose && (
                      <button
                        onClick={onClose}
                        className="flex-shrink-0 p-2 -mt-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        aria-label="Close modal"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="px-6 py-5">{children}</div>

                {/* Footer */}
                {footer && (
                  <div className="px-6 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                    {footer}
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
