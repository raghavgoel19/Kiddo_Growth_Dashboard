import type { FullDateRange, OrderStatus } from '../../api/types'

interface FilterBarProps {
  dateRange: FullDateRange
  orderStatus: OrderStatus
  onDateRangeChange: (range: FullDateRange) => void
  onOrderStatusChange: (status: OrderStatus) => void
}

const DATE_PRESETS: { label: string; value: FullDateRange }[] = [
  { label: 'Today', value: 'today' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '12m', value: '12m' },
  { label: 'All', value: 'all' },
]

const STATUS_OPTIONS: { label: string; value: OrderStatus }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Refunded', value: 'refunded' },
]

export function FilterBar({
  dateRange,
  orderStatus,
  onDateRangeChange,
  onOrderStatusChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onDateRangeChange(preset.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              dateRange === preset.value
                ? 'bg-[#00A86B] text-white'
                : 'bg-white text-slate-600 ring-1 ring-kiddo-border hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <select
        value={orderStatus}
        onChange={(e) => onOrderStatusChange(e.target.value as OrderStatus)}
        className="rounded-md border border-kiddo-border bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
