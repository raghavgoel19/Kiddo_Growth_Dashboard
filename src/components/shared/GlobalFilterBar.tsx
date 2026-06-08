import { useEffect, useState } from 'react'
import type { FullDateRange, OrderStatus } from '../../api/types'
import type { CompareMode } from '../../context/DashboardContext'
import { useDashboardContext } from '../../context/DashboardContext'
import { formatCustomRangeLabel } from '../../utils/dates'

const DATE_PRESETS: { label: string; value: FullDateRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last week', value: '7d' },
]

const STATUS_PILLS: { label: string; value: OrderStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Cancelled', value: 'cancelled' },
]

const COMPARE_OPTIONS: { label: string; value: CompareMode }[] = [
  { label: 'Previous period', value: 'previous' },
  { label: 'Same period last year', value: 'lastYear' },
  { label: 'Custom', value: 'custom' },
]

export function GlobalFilterBar() {
  const {
    filters,
    setDateRange,
    setCustomRange,
    setCompareCustomRange,
    toggleOrderStatus,
    setCompareEnabled,
    setCompareMode,
    clearFilters,
  } = useDashboardContext()
  const [expanded, setExpanded] = useState(false)
  const [from, setFrom] = useState(filters.customFrom ?? '')
  const [to, setTo] = useState(filters.customTo ?? '')
  const [compareFrom, setCompareFrom] = useState(filters.compareCustomFrom ?? '')
  const [compareTo, setCompareTo] = useState(filters.compareCustomTo ?? '')

  useEffect(() => {
    if (filters.customFrom) setFrom(filters.customFrom)
    if (filters.customTo) setTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

  const activeCustom = filters.dateMode === 'custom' && filters.customFrom && filters.customTo
  const activeRangeLabel = activeCustom
    ? formatCustomRangeLabel(filters.customFrom!, filters.customTo!)
    : DATE_PRESETS.find((p) => p.value === filters.dateRange)?.label ?? filters.dateRange

  const activeFilterCount =
    (activeCustom ? 1 : 0) +
    (filters.orderStatuses.includes('all') ? 0 : filters.orderStatuses.length) +
    (filters.compareEnabled ? 1 : 0)

  const applyCustom = () => {
    if (from && to) setCustomRange(from, to)
  }

  return (
    <div className="border-b border-[var(--border)] bg-white">
      <div className="flex items-center gap-3 px-6 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-xs text-[var(--accent)]">
              {activeFilterCount}
            </span>
          )}
        </button>
        <span className="rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
          {activeRangeLabel}
        </span>
        <button
          type="button"
          onClick={clearFilters}
          className="ml-auto text-xs text-[var(--text-secondary)] hover:underline"
        >
          Clear filters
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-[var(--border-light)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Date
            </span>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDateRange(preset.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  !activeCustom && filters.dateMode === 'preset' && filters.dateRange === preset.value
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Custom
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
            />
            <span className="text-[var(--text-tertiary)]">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={applyCustom}
              disabled={!from || !to}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={filters.compareEnabled}
                onChange={(e) => setCompareEnabled(e.target.checked)}
              />
              Compare to
            </label>
            {filters.compareEnabled && (
              <>
                <select
                  value={filters.compareMode ?? 'previous'}
                  onChange={(e) => setCompareMode(e.target.value as CompareMode)}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                >
                  {COMPARE_OPTIONS.map((o) => (
                    <option key={o.value ?? 'none'} value={o.value ?? ''}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {filters.compareMode === 'custom' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={compareFrom}
                      onChange={(e) => setCompareFrom(e.target.value)}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                    />
                    <span className="text-[var(--text-tertiary)]">→</span>
                    <input
                      type="date"
                      value={compareTo}
                      onChange={(e) => setCompareTo(e.target.value)}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => compareFrom && compareTo && setCompareCustomRange(compareFrom, compareTo)}
                      className="rounded-md bg-[var(--text-primary)] px-3 py-1 text-xs text-white"
                    >
                      Apply compare
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              Status
            </span>
            {STATUS_PILLS.map((pill) => {
              const active = filters.orderStatuses.includes(pill.value)
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => toggleOrderStatus(pill.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? 'bg-[var(--text-primary)] text-white'
                      : 'bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--border-light)]'
                  }`}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
