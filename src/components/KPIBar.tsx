import type { KPIs } from '../api/types'
import { formatINR, formatPercent } from '../utils/formatters'

interface KPIBarProps {
  kpis: KPIs
}

const KPI_CONFIG = [
  {
    key: 'totalOrders' as const,
    label: 'Orders',
    hint: 'All orders in selected period',
    format: (v: number) => v.toLocaleString('en-IN'),
  },
  {
    key: 'grossRevenue' as const,
    label: 'Revenue',
    hint: 'Sum of order totals (₹)',
    format: formatINR,
  },
  {
    key: 'averageOrderValue' as const,
    label: 'AOV',
    hint: 'Average order value',
    format: formatINR,
  },
  {
    key: 'totalCustomers' as const,
    label: 'Customers',
    hint: 'Registered customers (all time)',
    format: (v: number) => v.toLocaleString('en-IN'),
  },
  {
    key: 'repeatCustomerRate' as const,
    label: 'Repeat rate',
    hint: 'Customers with 2+ orders',
    format: (v: number) => formatPercent(v),
  },
  {
    key: 'avgItemsPerOrder' as const,
    label: 'Items / order',
    hint: 'Avg line-item quantity',
    format: (v: number) => v.toFixed(1),
  },
]

export function KPIBar({ kpis }: KPIBarProps) {
  return (
    <section id="kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {KPI_CONFIG.map(({ key, label, hint, format }) => (
        <div
          key={key}
          className="rounded-card border border-kiddo-border bg-white px-4 py-4"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1 tabular-nums text-2xl font-semibold tracking-tight text-slate-900">
            {format(kpis[key])}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-400">{hint}</p>
        </div>
      ))}
    </section>
  )
}
