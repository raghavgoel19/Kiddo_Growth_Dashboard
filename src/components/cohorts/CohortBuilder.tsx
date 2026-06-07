import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { useCohortBuilder, COHORT_PRESETS } from '../../hooks/useCohortBuilder'
import { useDashboardContext } from '../../context/DashboardContext'
import { L1_TAGS } from '../../utils/taxonomy'
import { classifyOrderPrimary } from '../../utils/taxonomy'
import { formatINR, maskPhone } from '../../utils/formatters'
import { ExportButton } from '../shared/ExportButton'
import { exportCustomersCsv, exportOrdersCsv } from '../../utils/orderAnalysis'
import { EmptyState } from '../shared/EmptyState'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { InfoTooltipByKey } from '../shared/InfoTooltip'
import type { DistanceBand } from '../../api/types'

const COLORS = ['#00A86B', '#059669', '#34D399', '#64748b', '#0F172A']
const DISTANCE_BANDS: DistanceBand[] = ['0-5km', '5-10km', '10-15km', '15-20km', '20km+', 'unknown']

export function CohortBuilder() {
  const { filteredOrders, filteredCustomers, productTagsMap } = useDashboardContext()
  const {
    filters,
    setFilters,
    matchingCustomers,
    cohortOrders,
    savedCohorts,
    saveCohort,
    applyPreset,
    summary,
    frequencyHistogram,
    aovDistribution,
    monthlyTrend,
  } = useCohortBuilder(filteredOrders, filteredCustomers, productTagsMap)
  const { drillFromChart } = useChartDrillDown()

  const categoryDonut = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of cohortOrders) {
      const cat = classifyOrderPrimary(o, productTagsMap)
      map.set(cat, (map.get(cat) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [cohortOrders, productTagsMap])

  if (matchingCustomers.length === 0 && cohortOrders.length === 0) {
    return (
      <div className="flex gap-6">
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          applyPreset={applyPreset}
          savedCohorts={savedCohorts}
          saveCohort={saveCohort}
        />
        <div className="flex-1">
          <EmptyState message="No customers match these cohort filters." onClear={() => applyPreset({})} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        applyPreset={applyPreset}
        savedCohorts={savedCohorts}
        saveCohort={saveCohort}
      />
      <div className="min-w-0 flex-1 space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Customers" value={summary.customers.toLocaleString('en-IN')} />
          <SummaryCard label="Orders" value={summary.orders.toLocaleString('en-IN')} />
          <SummaryCard label="GMV" value={formatINR(summary.gmv)} />
          <SummaryCard label="Share of GMV" value={`${summary.gmvShare.toFixed(1)}%`} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Repeat rate" value={`${summary.repeatRate.toFixed(1)}%`} />
          <SummaryCard label="AOV" value={formatINR(summary.aov)} />
          <SummaryCard label="Items / order" value={summary.avgItems.toFixed(1)} />
        </div>

        {categoryDonut.length > 0 && (
          <div className="rounded-card border border-kiddo-border bg-white p-4">
            <h3 className="inline-flex items-center gap-1 text-sm font-semibold">
              Category breakdown
              <InfoTooltipByKey metricKey="categorySplit" />
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  onClick={(_, i) =>
                    drillFromChart({
                      title: 'Cohort category',
                      subtitle: categoryDonut[i]?.name ?? '',
                      orders: filterOrdersForMetric(cohortOrders, productTagsMap, {
                        category: categoryDonut[i]?.name,
                      }),
                    })
                  }
                >
                  {categoryDonut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Order frequency" metricKey="cohortFrequency">
            <BarChart data={frequencyHistogram}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#00A86B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="AOV distribution" metricKey="cohortAov">
            <BarChart data={aovDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>

        {monthlyTrend.length > 0 && (
          <ChartCard title="Monthly order trend" metricKey="cohortMonthly">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="#00A86B" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>
        )}

        <div className="rounded-card border border-kiddo-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Customers in cohort</h3>
            <div className="flex gap-2">
              <ExportButton
                label="Export customers"
                onExport={() =>
                  exportCustomersCsv(matchingCustomers, filteredOrders, productTagsMap, 'cohort_customers')
                }
              />
              <ExportButton
                label="Export orders"
                onExport={() => exportOrdersCsv(cohortOrders, filteredOrders, productTagsMap, 'cohort_orders')}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Phone</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Spent</th>
                </tr>
              </thead>
              <tbody>
                {matchingCustomers.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2">{maskPhone(c.phone)}</td>
                    <td className="py-2 text-right">{c.orders_count}</td>
                    <td className="py-2 text-right">{formatINR(parseFloat(c.total_spent))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  metricKey,
  children,
}: {
  title: string
  metricKey: string
  children: React.ReactElement
}) {
  return (
    <div className="rounded-card border border-kiddo-border bg-white p-4">
      <h3 className="mb-3 inline-flex items-center gap-1 text-sm font-semibold">
        {title}
        <InfoTooltipByKey metricKey={metricKey} />
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function FilterPanel({
  filters,
  setFilters,
  applyPreset,
  savedCohorts,
  saveCohort,
}: {
  filters: import('../../hooks/useCohortBuilder').CohortFilters
  setFilters: React.Dispatch<React.SetStateAction<import('../../hooks/useCohortBuilder').CohortFilters>>
  applyPreset: (p: Partial<import('../../hooks/useCohortBuilder').CohortFilters>) => void
  savedCohorts: { name: string; filters: import('../../hooks/useCohortBuilder').CohortFilters }[]
  saveCohort: (name: string) => void
}) {
  return (
    <aside className="w-full shrink-0 space-y-3 rounded-card border border-kiddo-border bg-white p-4 lg:w-[300px]">
      <h3 className="text-sm font-semibold">Cohort filters</h3>
      <div className="flex flex-wrap gap-1.5">
        {COHORT_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.filters)}
            className="rounded-full bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
          >
            {p.label}
          </button>
        ))}
        {savedCohorts.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => applyPreset(s.filters)}
            className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
          >
            {s.name}
          </button>
        ))}
      </div>

      <SelectField
        label="Channel"
        value={filters.channel}
        onChange={(v) => setFilters((f) => ({ ...f, channel: v as typeof filters.channel }))}
        options={[
          { label: 'All', value: 'all' },
          { label: 'App', value: 'app' },
          { label: 'Website', value: 'website' },
        ]}
      />

      <NumberField label="Min orders" value={filters.minOrders} onChange={(v) => setFilters((f) => ({ ...f, minOrders: v }))} />
      <NumberField label="Max orders" value={filters.maxOrders} onChange={(v) => setFilters((f) => ({ ...f, maxOrders: v }))} />
      <NumberField label="Min spend ₹" value={filters.minSpend} onChange={(v) => setFilters((f) => ({ ...f, minSpend: v }))} />
      <NumberField label="Max spend ₹" value={filters.maxSpend} onChange={(v) => setFilters((f) => ({ ...f, maxSpend: v }))} />
      <NumberField label="Min AOV ₹" value={filters.minAov} onChange={(v) => setFilters((f) => ({ ...f, minAov: v }))} />
      <NumberField label="Max AOV ₹" value={filters.maxAov} onChange={(v) => setFilters((f) => ({ ...f, maxAov: v }))} />

      <SelectField
        label="Has discount"
        value={filters.hasDiscount}
        onChange={(v) => setFilters((f) => ({ ...f, hasDiscount: v as typeof filters.hasDiscount }))}
        options={[
          { label: 'Either', value: 'either' },
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
      />

      <DateField label="First order from" value={filters.firstOrderFrom} onChange={(v) => setFilters((f) => ({ ...f, firstOrderFrom: v }))} />
      <DateField label="First order to" value={filters.firstOrderTo} onChange={(v) => setFilters((f) => ({ ...f, firstOrderTo: v }))} />
      <DateField label="Last order from" value={filters.lastOrderFrom} onChange={(v) => setFilters((f) => ({ ...f, lastOrderFrom: v }))} />
      <DateField label="Last order to" value={filters.lastOrderTo} onChange={(v) => setFilters((f) => ({ ...f, lastOrderTo: v }))} />
      <NumberField
        label="Inactive days+"
        value={filters.minDaysSinceLastOrder}
        onChange={(v) => setFilters((f) => ({ ...f, minDaysSinceLastOrder: v }))}
      />

      <div>
        <p className="text-xs text-slate-500">Distance bands</p>
        <div className="mt-1 space-y-1">
          {DISTANCE_BANDS.map((band) => (
            <label key={band} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.distanceBands.includes(band)}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    distanceBands: e.target.checked
                      ? [...f.distanceBands, band]
                      : f.distanceBands.filter((b) => b !== band),
                  }))
                }
              />
              {band}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-xs text-slate-500">
        Pincodes (comma-separated)
        <input
          type="text"
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={filters.pincodes.join(', ')}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              pincodes: e.target.value
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>

      <div>
        <p className="text-xs text-slate-500">Categories</p>
        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
          {L1_TAGS.map((cat) => (
            <label key={cat} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    categories: e.target.checked ? [...f.categories, cat] : f.categories.filter((c) => c !== cat),
                  }))
                }
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="w-full rounded-md bg-[#00A86B] px-3 py-2 text-sm text-white"
        onClick={() => {
          const name = prompt('Cohort name')
          if (!name) return
          const existing = savedCohorts.find((s) => s.name === name)
          if (existing && !confirm(`Overwrite saved cohort "${name}"?`)) return
          saveCohort(name)
        }}
      >
        Save cohort
      </button>
    </aside>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type="date"
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <select
        className="mt-1 w-full rounded border px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function parseFloat(v: string) {
  return Number(v) || 0
}
