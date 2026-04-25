import { useRef, useState, useEffect } from 'react';

/**
 * Tracks newly appeared order IDs across polling updates.
 * Returns a Set of order IDs that should be visually highlighted.
 * New IDs are automatically cleared after `duration` ms.
 *
 * Usage:
 *   const highlightedIds = useNewOrderHighlight(orders);
 *   // In JSX: className={highlightedIds.has(o.id) ? 'new-order-highlight' : ''}
 */
export function useNewOrderHighlight<T extends { id: number }>(
  orders: T[],
  duration = 5000,
): Set<number> {
  const prevIdsRef = useRef<Set<number> | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const currentIds = new Set(orders.map(o => o.id));

    // First load — store IDs, don't highlight anything
    if (prevIdsRef.current === null) {
      prevIdsRef.current = currentIds;
      return;
    }

    // Find IDs that are new (present now but weren't before)
    const newIds = new Set<number>();
    currentIds.forEach(id => {
      if (!prevIdsRef.current!.has(id)) {
        newIds.add(id);
      }
    });

    // Always update the stored IDs
    prevIdsRef.current = currentIds;

    if (newIds.size > 0) {
      // Merge new highlights with any existing ones
      setHighlightedIds(prev => {
        const merged = new Set(prev);
        newIds.forEach(id => merged.add(id));
        return merged;
      });

      // Clear these specific highlights after duration
      const timer = setTimeout(() => {
        setHighlightedIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [orders, duration]);

  return highlightedIds;
}
