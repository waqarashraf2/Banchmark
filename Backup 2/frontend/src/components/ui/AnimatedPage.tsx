import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
  animation?: 'fade' | 'slideUp' | 'slideRight' | 'scale' | 'none';
  delay?: number;
  stagger?: boolean;
}

const animations: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  slideRight: {
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 16 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export default function AnimatedPage({ 
  children, 
  className = '', 
  animation = 'slideUp',
  delay = 0,
  stagger = false,
}: AnimatedPageProps) {
  const variants = stagger ? staggerContainer : animations[animation];
  
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1],
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger item for use inside AnimatedPage with stagger=true
export function AnimatedItem({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string 
}) {
  return (
    <motion.div
      variants={{
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Hover scale wrapper for interactive elements
export function AnimatedHover({ 
  children, 
  scale = 1.02,
  className = '' 
}: { 
  children: ReactNode; 
  scale?: number;
  className?: string 
}) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Number counter animation
export function AnimatedCounter({ 
  value, 
  className = '' 
}: { 
  value: number; 
  className?: string 
}) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        key={value}
      >
        {value.toLocaleString()}
      </motion.span>
    </motion.span>
  );
}
