import { memo } from 'react'
import type { FullDateRange } from '../../api/types'
import { DeltaBadge } from './DeltaBadge'
import { InfoTooltipByKey } from './InfoTooltip'

const OVERRIDE_OPTIONS: { label: string; value: FullDateRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
]

interface KPICardProps {
  label: string
  value: string
  vsPrevDay: { value: string; positive: boolean }
  vsPrevWeek: { value: string; positive: boolean }
  timeLabel?: string
  metricKey?: string
  kpiId?: string
  dateOverride?: FullDateRange
  onDateOverrideChange?: (range: FullDateRange | null) => void
}

export const KPICard = memo(function KPICard({
  label,
  value,
  vsPrevDay,
  vsPrevWeek,
  timeLabel,
  metricKey,
  kpiId,
  dateOverride,
  onDateOverrideChange,
}: KPICardProps) {
  const compareLabel = timeLabel ? `vs Yesterday (${timeLabel})` : 'vs Yesterday'
  const weekLabel = timeLabel ? `vs Last Week (${timeLabel})` : 'vs Last Week'
  const showOverride = kpiId && onDateOverrideChange

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
          {label}
          {metricKey ? <InfoTooltipByKey metricKey={metricKey} /> : null}
        </p>
        {showOverride && (
          <select
            className="max-w-[90px] rounded border border-[var(--border)] px-1 py-0.5 text-[10px] text-[var(--text-secondary)]"
            value={dateOverride ?? 'today'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value as FullDateRange
              onDateOverrideChange!(v === 'today' ? null : v)
            }}
          >
            {OVERRIDE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mt-2 tabular-nums text-[28px] font-bold leading-none text-[var(--text-primary)]">
        {value}
      </p>
      {dateOverride && dateOverride !== 'today' && (
        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
          Showing {OVERRIDE_OPTIONS.find((o) => o.value === dateOverride)?.label ?? dateOverride}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-1.5">
        {!dateOverride || dateOverride === 'today' ? (
          <>
            <DeltaBadge label={compareLabel} value={vsPrevDay.value} positive={vsPrevDay.positive} />
            <DeltaBadge label={weekLabel} value={vsPrevWeek.value} positive={vsPrevWeek.positive} />
          </>
        ) : null}
      </div>
    </div>
  )
})
