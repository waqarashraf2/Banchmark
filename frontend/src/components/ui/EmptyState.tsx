import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    container: 'py-10 px-4',
    iconBox: 'w-12 h-12 rounded-xl mb-3',
    icon: 'h-5 w-5',
    title: 'text-sm',
    description: 'text-xs mt-1',
    action: 'mt-3',
  },
  md: {
    container: 'py-16 px-6',
    iconBox: 'w-14 h-14 rounded-2xl mb-4',
    icon: 'h-6 w-6',
    title: 'text-[15px]',
    description: 'text-sm mt-1.5',
    action: 'mt-4',
  },
  lg: {
    container: 'py-24 px-8',
    iconBox: 'w-20 h-20 rounded-3xl mb-6',
    icon: 'h-8 w-8',
    title: 'text-lg',
    description: 'text-base mt-2',
    action: 'mt-6',
  },
};

export default function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  action,
  size = 'md' 
}: EmptyStateProps) {
  const s = sizeClasses[size];
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center ${s.container}`}
    >
      <div className={`${s.iconBox} bg-surface-secondary flex items-center justify-center`}>
        <Icon className={`${s.icon} text-ink-tertiary`} />
      </div>
      <h3 className={`${s.title} font-semibold text-ink-secondary text-center`}>{title}</h3>
      {description && (
        <p className={`${s.description} text-ink-tertiary text-center max-w-sm`}>
          {description}
        </p>
      )}
      {action && <div className={s.action}>{action}</div>}
    </motion.div>
  );
}
