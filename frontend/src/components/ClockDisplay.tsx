import { useState, useEffect, memo } from 'react';

function getProjectTime(tz: string): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: tz || 'Australia/Sydney',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function getTzLabel(tz: string): string {
  if (!tz) return 'Project Time';
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
    const name = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return name || tz.split('/').pop()?.replace(/_/g, ' ') || 'Project Time';
  } catch { return 'Project Time'; }
}

interface ClockDisplayProps {
  timezone: string;
  className?: string;
  showLabel?: boolean;
}

/**
 * Isolated clock component that ticks every second.
 * Wrapped in React.memo so the 1-second setInterval only re-renders
 * this tiny subtree instead of the entire parent page (800+ lines).
 */
function ClockDisplayInner({ timezone, className, showLabel = true }: ClockDisplayProps) {
  const [time, setTime] = useState(() => getProjectTime(timezone));

  useEffect(() => {
    setTime(getProjectTime(timezone));
    const timer = setInterval(() => setTime(getProjectTime(timezone)), 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  return (
    <span className={className}>
      {showLabel && <>{getTzLabel(timezone)}: </>}
      {time}
    </span>
  );
}

const ClockDisplay = memo(ClockDisplayInner);
export default ClockDisplay;
export { getProjectTime };
