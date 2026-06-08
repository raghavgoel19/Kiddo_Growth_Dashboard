import { useEffect, useState } from 'react'
import { useDashboardContext } from '../../context/DashboardContext'
import { DATE_PRESET_OPTIONS } from '../../utils/rangeParams'
import { formatCustomRangeLabel } from '../../utils/dates'

export function DateFilterBar() {
  const { filters, setDateRange, setCustomRange } = useDashboardContext()
  const [customOpen, setCustomOpen] = useState(false)
  const [from, setFrom] = useState(filters.customFrom ?? '')
  const [to, setTo] = useState(filters.customTo ?? '')

  useEffect(() => {
    if (filters.customFrom) setFrom(filters.customFrom)
    if (filters.customTo) setTo(filters.customTo)
  }, [filters.customFrom, filters.customTo])

  const isCustomActive = filters.dateMode === 'custom' && filters.customFrom && filters.customTo

  const applyCustom = () => {
    if (from && to) {
      setCustomRange(from, to)
      setCustomOpen(false)
    }
  }

  return (
    <div className="border-b border-[var(--border)] bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESET_OPTIONS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              setDateRange(preset.value)
              setCustomOpen(false)
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !isCustomActive && filters.dateMode === 'preset' && filters.dateRange === preset.value
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent)]'
            }`}
          >
            {preset.label}
          </button>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isCustomActive
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[var(--accent)]'
            }`}
          >
            {isCustomActive
              ? formatCustomRangeLabel(filters.customFrom!, filters.customTo!)
              : 'Custom ▾'}
          </button>

          {customOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white p-3 shadow-lg">
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
          )}
        </div>
      </div>
    </div>
  )
}

/** Status / compare filters — shown below date bar when expanded. */
export function AdvancedFilterBar() {
  const {
    filters,
    toggleOrderStatus,
    setCompareEnabled,
    setCompareMode,
    setCompareCustomRange,
    clearFilters,
  } = useDashboardContext()
  const [expanded, setExpanded] = useState(false)
  const [compareFrom, setCompareFrom] = useState(filters.compareCustomFrom ?? '')
  const [compareTo, setCompareTo] = useState(filters.compareCustomTo ?? '')

  return (
    <div className="border-b border-[var(--border-light)] bg-[var(--bg-app)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="px-6 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        {expanded ? '▾ Hide status filters' : '▸ Status & compare filters'}
      </button>
      {expanded && (
        <div className="space-y-3 px-6 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'paid', 'pending', 'refunded', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleOrderStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  filters.orderStatuses.includes(status)
                    ? 'bg-[var(--text-primary)] text-white'
                    : 'bg-white text-[var(--text-secondary)]'
                }`}
              >
                {status}
              </button>
            ))}
            <button type="button" onClick={clearFilters} className="ml-auto text-xs underline">
              Reset status
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
            />
            Compare to previous period
          </label>
          {filters.compareEnabled && filters.compareMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
              <span>→</span>
              <input type="date" value={compareTo} onChange={(e) => setCompareTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
              <button
                type="button"
                onClick={() => compareFrom && compareTo && setCompareCustomRange(compareFrom, compareTo)}
                className="rounded bg-[var(--text-primary)] px-3 py-1 text-xs text-white"
              >
                Apply compare
              </button>
            </div>
          )}
          {filters.compareEnabled && (
            <select
              value={filters.compareMode ?? 'previous'}
              onChange={(e) => setCompareMode(e.target.value as typeof filters.compareMode)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="previous">Previous period</option>
              <option value="lastYear">Same period last year</option>
              <option value="custom">Custom</option>
            </select>
          )}
        </div>
      )}
    </div>
  )
}
