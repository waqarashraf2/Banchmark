import React, { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonTableRow } from './Skeleton';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  loading?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }> | ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  className?: string;
  compact?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectRow?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  rowClassName?: (row: T) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any> = Record<string, any>>({
  columns, data, keyField = 'id', loading, emptyIcon, emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display.', pageSize = 10, onRowClick, 
  className = '', compact = false, stickyHeader = false, striped = false,
  selectable = false, selectedRows = [], onSelectRow, onSelectAll, rowClassName,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey];
      if (aVal == null) return 1; if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  };

  const allSelected = selectable && paged.length > 0 && paged.every(row => selectedRows.includes(String(row[keyField])));
  const someSelected = selectable && paged.some(row => selectedRows.includes(String(row[keyField]))) && !allSelected;

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl overflow-hidden ring-1 ring-black/[0.04] ${className}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/80"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={columns.length} className="border-b border-slate-50 last:border-0" />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-xl ring-1 ring-black/[0.04] ${className}`}>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          {emptyIcon && (
            <div className="w-14 h-14 rounded-2xl bg-surface-secondary flex items-center justify-center mb-4">
              {React.isValidElement(emptyIcon) 
                ? emptyIcon 
                : React.createElement(emptyIcon as React.ComponentType<{ className?: string }>, { className: 'w-6 h-6 text-ink-tertiary' })
              }
            </div>
          )}
          <h3 className="text-sm font-semibold text-ink-secondary">{emptyTitle}</h3>
          <p className="text-sm text-ink-tertiary mt-1 text-center max-w-xs">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  const cellPad = compact ? 'px-4 py-2' : 'px-4 py-3';

  return (
    <div className={`bg-white rounded-xl overflow-hidden ring-1 ring-black/[0.04] shadow-sm ${className}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr className="border-b border-slate-100">
              {selectable && (
                <th className={`${cellPad} bg-slate-50/80 w-10`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`
                    ${cellPad} 
                    text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider 
                    bg-slate-50/80
                    ${alignClasses[col.align || 'left']}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-ink-secondary group' : ''} 
                    ${col.className || ''}
                  `}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {col.sortable && (
                      <span className={`transition-colors ${sortKey === col.key ? 'text-ink-secondary' : 'text-ink-tertiary/50 group-hover:text-ink-tertiary'}`}>
                        {sortKey === col.key 
                          ? (sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) 
                          : <ChevronsUpDown className="h-3.5 w-3.5" />
                        }
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <AnimatePresence mode="popLayout">
              {paged.map((row, idx) => {
                const rowId = String(row[keyField]);
                const isSelected = selectable && selectedRows.includes(rowId);
                return (
                  <motion.tr
                    key={row[keyField] as string ?? idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`
                      group transition-colors
                      ${onRowClick ? 'cursor-pointer' : ''} 
                      ${isSelected ? 'bg-brand-primary/5' : striped && idx % 2 === 1 ? 'bg-surface-secondary/50' : 'bg-transparent'}
                      hover:bg-surface-secondary
                      ${rowClassName ? rowClassName(row) : ''}
                    `}
                  >
                    {selectable && (
                      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectRow?.(rowId, e.target.checked)}
                          className="w-4 h-4 rounded border-border-default text-brand-primary focus:ring-brand-primary/30"
                          aria-label={`Select row ${rowId}`}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td 
                        key={col.key} 
                        className={`
                          ${cellPad} text-[13px] text-ink-primary
                          ${alignClasses[col.align || 'left']}
                          ${col.className || ''}
                        `}
                      >
                        {col.render ? col.render(row, page * pageSize + idx) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-ink-tertiary">
            Showing <span className="font-medium text-ink-secondary">{page * pageSize + 1}</span>–
            <span className="font-medium text-ink-secondary">{Math.min((page + 1) * pageSize, sorted.length)}</span> of{' '}
            <span className="font-medium text-ink-secondary">{sorted.length}</span> results
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-ink-tertiary hover:text-ink-secondary hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`
                    w-8 h-8 rounded-lg text-xs font-medium transition-all
                    ${p === page 
                      ? 'bg-brand-primary text-white shadow-sm' 
                      : 'text-ink-secondary hover:bg-surface-tertiary'
                    }
                  `}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-ink-tertiary hover:text-ink-secondary hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
