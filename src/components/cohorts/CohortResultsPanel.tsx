import { memo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CohortDeepAnalysis } from '../../utils/cohortAnalysis'
import { formatINR, maskPhone, formatIST } from '../../utils/formatters'
import { getCustomerTier } from '../../utils/orderAnalysis'
import { downloadCsv, exportFilename } from '../../utils/csv'
import type { CustomerSummary } from '../../utils/customerSummary'
import { VirtualTable } from '../shared/VirtualTable'
import { ExportButton } from '../shared/ExportButton'
import { EmptyState } from '../shared/EmptyState'

const COLORS = ['#00A86B', '#059669', '#34D399', '#64748b', '#0F172A', '#94a3b8']

interface Props {
  analysis: CohortDeepAnalysis
  loading?: boolean
}

function fmtDate(iso: string) {
  return formatIST(iso).split(',')[0]
}

function exportCustomerCsv(customers: CustomerSummary[]) {
  downloadCsv(
    exportFilename('cohort_customers'),
    [
      'phone',
      'orders',
      'spent_inr',
      'aov_inr',
      'first_order',
      'last_order',
      'days_since_last',
      'channel',
      'category',
      'distance',
      'tier',
    ],
    customers.map((c) => [
      maskPhone(c.phone),
      c.totalOrders,
      c.totalSpent,
      c.aov,
      fmtDate(c.firstOrderDate),
      fmtDate(c.lastOrderDate),
      c.daysSinceLastOrder,
      c.primaryChannel,
      c.primaryCategory,
      c.distanceBand,
      getCustomerTier(c.totalOrders),
    ])
  )
}

const BEHAVIOUR_LABELS: { key: keyof CohortDeepAnalysis['behaviour']; label: string; fmt: (v: number) => string }[] = [
  { key: 'repeatRate', label: 'Repeat rate', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'avgOrdersPerCustomer', label: 'Orders / customer', fmt: (v) => v.toFixed(1) },
  { key: 'avgSpend', label: 'Avg spend', fmt: formatINR },
  { key: 'aov', label: 'AOV', fmt: formatINR },
  { key: 'avgItemsPerOrder', label: 'Items / order', fmt: (v) => v.toFixed(1) },
  { key: 'avgDaysBetweenOrders', label: 'Avg days between', fmt: (v) => v.toFixed(1) },
  { key: 'appPct', label: 'App %', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'websitePct', label: 'Website %', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'avgDistanceKm', label: 'Avg distance (km)', fmt: (v) => v.toFixed(1) },
]

export const CohortResultsPanel = memo(function CohortResultsPanel({ analysis, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-kiddo-border bg-white py-16 text-sm text-slate-500">
        Computing cohort analysis…
      </div>
    )
  }

  if (analysis.summary.customers === 0) {
    return <EmptyState message="No customers match these cohort filters." />
  }

  const { summary, behaviour, aovTrend, firstOrder, frequency, churn, categoryEvolution, customers } = analysis

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Customers" value={summary.customers.toLocaleString('en-IN')} />
        <KpiCard label="Orders" value={summary.orders.toLocaleString('en-IN')} />
        <KpiCard label="GMV" value={formatINR(summary.gmv)} />
        <KpiCard label="% store GMV" value={`${summary.gmvShare.toFixed(1)}%`} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Behaviour metrics</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {BEHAVIOUR_LABELS.map(({ key, label, fmt }) => (
            <KpiCard key={key} label={label} value={fmt(behaviour[key])} />
          ))}
        </div>
      </section>

      <ChartBox title="AOV trend (cohort vs store)">
        <LineChart data={aovTrend}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => formatINR(v)} />
          <Line type="monotone" dataKey="cohortAov" name="Cohort" stroke="#00A86B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="storeAov" name="Store" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ChartBox>

      <section>
        <h3 className="mb-3 text-sm font-semibold">First order analysis</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <DonutBox title="L1 category" data={firstOrder.l1Donut} />
          <ChartBox title="L2 categories" height={200}>
            <BarChart data={firstOrder.l2Bars} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#00A86B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
          <ChartBox title="First order AOV">
            <BarChart data={firstOrder.aovHistogram}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
          <DonutBox title="Channel" data={firstOrder.channelDonut} />
          <ChartBox title="Hour of day">
            <BarChart data={firstOrder.hourBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#34D399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
          <ChartBox title="Day of week">
            <BarChart data={firstOrder.dowBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Order frequency</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartBox title="Orders per customer">
            <BarChart data={frequency.histogram}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#00A86B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
          <ChartBox title="Days between orders">
            <BarChart data={frequency.daysBetweenHistogram}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Avg days to 2nd order" value={frequency.avgDaysToSecond.toFixed(1)} />
          <KpiCard label="% 2nd within 7d" value={`${frequency.pctSecondWithin7d.toFixed(1)}%`} />
          <KpiCard label="% 2nd within 30d" value={`${frequency.pctSecondWithin30d.toFixed(1)}%`} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Churn & retention</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartBox title="Days since last order" className="lg:col-span-2">
            <BarChart data={churn.buckets}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0F172A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
          <div className="space-y-3">
            <KpiCard label="Avg days since last" value={churn.avgDaysSinceLast.toFixed(1)} />
            <KpiCard label="Churn risk %" value={`${churn.churnRiskPct.toFixed(1)}%`} />
          </div>
        </div>
      </section>

      <div className="rounded-card border border-kiddo-border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">Category evolution</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">First category</th>
                <th className="pb-2 text-right">Same %</th>
                <th className="pb-2">Top switch</th>
                <th className="pb-2 text-right">Switch %</th>
              </tr>
            </thead>
            <tbody>
              {categoryEvolution.map((row) => (
                <tr key={row.firstCategory} className="border-t border-slate-100">
                  <td className="py-2">{row.firstCategory}</td>
                  <td className="py-2 text-right tabular-nums">{row.samePct.toFixed(1)}%</td>
                  <td className="py-2">{row.topSwitch}</td>
                  <td className="py-2 text-right tabular-nums">{row.topSwitchPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Customers ({customers.length.toLocaleString('en-IN')})</h3>
          <ExportButton onExport={() => exportCustomerCsv(customers)} />
        </div>
        <VirtualTable
          rows={customers}
          getRowKey={(c) => c.id}
          header={
            <tr className="text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Phone</th>
              <th className="pb-2 text-right">Orders</th>
              <th className="pb-2 text-right">Spent</th>
              <th className="pb-2 text-right">AOV</th>
              <th className="pb-2">First</th>
              <th className="pb-2">Last</th>
              <th className="pb-2 text-right">Days</th>
              <th className="pb-2">Channel</th>
              <th className="pb-2">Category</th>
              <th className="pb-2">Distance</th>
              <th className="pb-2">Tier</th>
            </tr>
          }
          renderRow={(c) => (
            <>
              <td className="py-2">{maskPhone(c.phone)}</td>
              <td className="py-2 text-right tabular-nums">{c.totalOrders}</td>
              <td className="py-2 text-right tabular-nums">{formatINR(c.totalSpent)}</td>
              <td className="py-2 text-right tabular-nums">{formatINR(c.aov)}</td>
              <td className="py-2 whitespace-nowrap text-xs">{fmtDate(c.firstOrderDate)}</td>
              <td className="py-2 whitespace-nowrap text-xs">{fmtDate(c.lastOrderDate)}</td>
              <td className={`py-2 text-right tabular-nums ${c.daysSinceLastOrder >= 20 ? 'font-medium text-red-600' : ''}`}>
                {c.daysSinceLastOrder}
              </td>
              <td className="py-2">
                <span className={c.primaryChannel === 'app' ? 'badge-app' : 'badge-website'}>
                  {c.primaryChannel === 'app' ? 'App' : 'Website'}
                </span>
              </td>
              <td className="py-2 text-xs">{c.primaryCategory}</td>
              <td className="py-2 text-xs">{c.distanceBand}</td>
              <td className="py-2 text-xs whitespace-nowrap">{getCustomerTier(c.totalOrders)}</td>
            </>
          )}
        />
      </div>
    </div>
  )
})

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ChartBox({
  title,
  children,
  height = 200,
  className = '',
}: {
  title: string
  children: React.ReactElement
  height?: number
  className?: string
}) {
  return (
    <div className={`rounded-card border border-kiddo-border bg-white p-4 ${className}`}>
      <h4 className="mb-2 text-xs font-semibold text-slate-600">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function DonutBox({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-card border border-kiddo-border bg-white p-4">
      <h4 className="mb-2 text-xs font-semibold text-slate-600">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
