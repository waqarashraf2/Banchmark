/**
 * Rich skeleton loading screens for every dashboard.
 * Each skeleton mirrors the real layout so users see exactly what's coming.
 */

/* ─── Primitives ─── */

function Pulse({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} style={style} />;
}

function PulseCircle({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-slate-200/70 ${className}`} />;
}

/* ─── Page Header Skeleton ─── */
export function SkeletonPageHeader({ titleWidth = 'w-52', subtitleWidth = 'w-80' }: { titleWidth?: string; subtitleWidth?: string }) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center gap-3">
        <Pulse className={`h-7 ${titleWidth}`} />
        <Pulse className="h-6 w-16 rounded-full" />
      </div>
      <Pulse className={`h-4 ${subtitleWidth}`} />
    </div>
  );
}

/* ─── Stat Card Skeleton ─── */
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-4">
      <div className="flex items-start justify-between mb-3">
        <Pulse className="h-4 w-20" />
        <Pulse className="h-9 w-9 rounded-lg" />
      </div>
      <Pulse className="h-7 w-16 mb-1" />
      <Pulse className="h-3 w-24 mt-1" />
    </div>
  );
}

/* ─── Tab Navigation Skeleton ─── */
export function SkeletonTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-2">
          <Pulse className="h-4 w-4" />
          <Pulse className={`h-4 ${i === 0 ? 'w-16' : 'w-14'}`} />
        </div>
      ))}
    </div>
  );
}

/* ─── Chart Skeleton ─── */
export function SkeletonChart({ height = 'h-60' }: { height?: string }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-5">
      <div className="space-y-1 mb-4">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-48" />
      </div>
      <div className={`${height} flex items-end gap-3 px-4`}>
        {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
            <Pulse className="w-full rounded-t-md" style={{ height: `${h}%` }} />
            <Pulse className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pie Chart Skeleton ─── */
export function SkeletonPieChart() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-5">
      <div className="space-y-1 mb-4">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-24" />
      </div>
      <div className="flex items-center justify-center py-6">
        <div className="relative">
          <PulseCircle className="h-36 w-36" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-white" />
          </div>
        </div>
      </div>
      <div className="flex gap-4 justify-center mt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <PulseCircle className="h-2.5 w-2.5" />
            <Pulse className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Table Skeleton ─── */
export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <Pulse className="h-4 w-4" />
        <Pulse className="h-4 w-32" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Pulse className="h-3 w-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-t border-slate-50">
                {Array.from({ length: columns }).map((_, col) => (
                  <td key={col} className="px-4 py-3">
                    <Pulse className={`h-4 ${col === 0 ? 'w-8' : col === 1 ? 'w-28' : 'w-16'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Role Card Skeleton (for OpsManager role stats) ─── */
function SkeletonRoleCard() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Pulse className="h-8 w-8 rounded-lg" />
        <Pulse className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <Pulse className="h-5 w-8 mx-auto mb-1" />
          <Pulse className="h-2.5 w-10 mx-auto" />
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <Pulse className="h-5 w-8 mx-auto mb-1" />
          <Pulse className="h-2.5 w-10 mx-auto" />
        </div>
      </div>
    </div>
  );
}

/* ─── Overtime Analysis Skeleton (CEO) ─── */
function SkeletonOvertimeCard() {
  return (
    <div className="rounded-xl p-4 ring-1 ring-slate-100 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <Pulse className="h-4 w-4" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="h-7 w-12 mb-1" />
      <Pulse className="h-3 w-28" />
    </div>
  );
}

/* ─── Project Card Skeleton (collapsible row) ─── */
function SkeletonProjectCard() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <Pulse className="h-4 w-40 mb-1.5" />
            <Pulse className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Pulse className="h-6 w-16 rounded-full" />
          <Pulse className="h-6 w-16 rounded-full" />
          <Pulse className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

/* ─── Daily Ops Summary Row Skeleton ─── */
function SkeletonDailyOpsRow() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Pulse className="h-8 w-8 rounded-lg" />
        <div>
          <Pulse className="h-4 w-36 mb-1" />
          <Pulse className="h-3 w-20" />
        </div>
      </div>
      <div className="flex gap-4">
        <Pulse className="h-5 w-12 rounded-full" />
        <Pulse className="h-5 w-12 rounded-full" />
        <Pulse className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

/* ─── Current Order Card Skeleton (Worker) ─── */
function SkeletonCurrentOrder() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pulse className="h-5 w-5" />
          <Pulse className="h-5 w-32" />
        </div>
        <Pulse className="h-7 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Pulse className="h-3 w-16 mb-1" />
            <Pulse className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
        <Pulse className="h-10 w-32 rounded-lg" />
        <Pulse className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

/* ─── Filter Bar Skeleton ─── */
function SkeletonFilterBar() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Pulse className="h-9 w-40 rounded-lg" />
      <Pulse className="h-9 w-36 rounded-lg" />
      <Pulse className="h-9 w-28 rounded-lg" />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════ */
/* ═══ DASHBOARD-SPECIFIC COMPOSITIONS ═══ */
/* ═══════════════════════════════════════════════════════════════ */

/** CEO / Director Dashboard Skeleton */
export function CEODashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader titleWidth="w-48" subtitleWidth="w-96" />
      <SkeletonTabs count={2} />

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Overtime analysis 4-col */}
      <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Pulse className="h-4 w-48 mb-1" />
            <Pulse className="h-3 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Pulse className="h-4 w-4" />
            <Pulse className="h-3 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonOvertimeCard key={i} />)}
        </div>
      </div>

      {/* Charts row: 3/5 + 2/5 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <SkeletonChart height="h-60" />
        </div>
        <div className="lg:col-span-2">
          <SkeletonPieChart />
        </div>
      </div>

      {/* Country breakdown */}
      <div className="space-y-3">
        <Pulse className="h-4 w-40" />
        {Array.from({ length: 3 }).map((_, i) => <SkeletonProjectCard key={i} />)}
      </div>
    </div>
  );
}

/** Operations Manager Dashboard Skeleton */
export function OpsManagerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader titleWidth="w-56" subtitleWidth="w-72" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>

      <SkeletonTabs count={4} />

      {/* Role cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Pulse className="h-4 w-4" />
          <Pulse className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRoleCard key={i} />)}
        </div>
      </div>

      {/* Project list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Pulse className="h-4 w-4" />
          <Pulse className="h-4 w-36" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => <SkeletonProjectCard key={i} />)}
      </div>
    </div>
  );
}

/** Project Manager Dashboard Skeleton */
export function PMDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader titleWidth="w-64" subtitleWidth="w-96" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {['My Projects', 'Staff Report', 'Order Queue', 'Teams'].map((_label, i) => (
          <div key={i} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4">
            <Pulse className="h-4 w-20" />
            <Pulse className="h-4 w-6 rounded-full" />
          </div>
        ))}
      </div>

      {/* Project cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonProjectCard key={i} />)}
      </div>
    </div>
  );
}

/** Worker Dashboard Skeleton */
export function WorkerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader titleWidth="w-48" subtitleWidth="w-64" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl ring-1 ring-black/[0.04] p-4">
            <div className="flex items-start justify-between mb-3">
              <Pulse className="h-4 w-20" />
              <Pulse className="h-9 w-9 rounded-lg" />
            </div>
            <Pulse className="h-7 w-14 mb-1" />
            {i === 3 && (
              /* Progress bar on last card */
              <div className="mt-2">
                <Pulse className="h-2 w-full rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Current order */}
      <SkeletonCurrentOrder />

      {/* Action button */}
      <div className="flex justify-center">
        <Pulse className="h-12 w-56 rounded-xl" />
      </div>

      {/* Completed orders table */}
      <SkeletonTable rows={4} columns={5} />
    </div>
  );
}

/** Accounts Manager Dashboard Skeleton */
export function AccountsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader titleWidth="w-48" subtitleWidth="w-64" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Billing summary (4 colored boxes) */}
      <div className="bg-white rounded-xl ring-1 ring-black/[0.04] p-5">
        <Pulse className="h-4 w-36 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 bg-slate-50 ring-1 ring-slate-100">
              <Pulse className="h-3 w-20 mb-2" />
              <Pulse className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Country breakdown */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonProjectCard key={i} />)}
      </div>
    </div>
  );
}

/** LiveQA Dashboard - Table Section Skeleton */
export function LiveQATableSkeleton() {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/[0.04] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-700">
              {['Date', 'Priority', 'Address', 'Drawer', 'D-LiveQA', 'Checker', 'C-LiveQA', 'Status'].map((col) => (
                <th key={col} className="px-3 py-2.5">
                  <Pulse className="h-3 w-full bg-brand-600/40" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, row) => (
              <tr key={row} className="border-t border-slate-50">
                {Array.from({ length: 8 }).map((_, col) => (
                  <td key={col} className="px-3 py-3">
                    <Pulse className={`h-4 ${col === 2 ? 'w-32' : 'w-14'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
        <Pulse className="h-4 w-32" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Pulse key={i} className="h-8 w-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** LiveQA Dashboard - Stats Section Skeleton */
export function LiveQAStatsSkeleton() {
  return (
    <div className="space-y-5">
      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      {/* Worker table */}
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}

/** Daily Operations View Skeleton */
export function DailyOpsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header + date picker */}
      <div className="flex items-center justify-between">
        <Pulse className="h-7 w-44" />
        <div className="flex items-center gap-2">
          <Pulse className="h-9 w-32 rounded-lg" />
          <Pulse className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <SkeletonFilterBar />

      {/* 4 summary stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl ring-1 ring-black/[0.04] p-3">
            <Pulse className="h-3 w-20 mb-2" />
            <Pulse className="h-6 w-10" />
          </div>
        ))}
      </div>

      {/* Project rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonDailyOpsRow key={i} />)}
      </div>
    </div>
  );
}
