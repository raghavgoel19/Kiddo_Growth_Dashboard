import { memo, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Order, ProductTagsMap } from '../../api/types'
import type { L2RepeatRow } from '../../utils/retentionMetrics'
import {
  computeDailyPowerUsers,
  computeL2RepeatRates,
  computeMonthlyFrequency,
  computeOrderCountCohortComparison,
  computeRepeatFunnel,
  powerPctBg,
  powerPctColor,
} from '../../utils/retentionMetrics'
import { formatINR, parseMoney } from '../../utils/formatters'
import { IST } from '../../utils/dates'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'
import { FirstOrderSignalsPanel } from '../retention/FirstOrderSignalsPanel'
import { ChurnRiskPanel } from '../retention/ChurnRiskPanel'
import { InterventionTimingPanel } from '../retention/InterventionTimingPanel'
import { LtvProjectionsPanel } from '../retention/LtvProjectionsPanel'
import { avg, buildCustomerSummaries } from '../../utils/customerSummary'
import type { CustomerSummary } from '../../utils/customerSummary'

interface RetentionTabProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const SUB_TABS = [
  'First Order Signals',
  'Churn Risk',
  'Intervention Timing',
  'LTV Projections',
  'Monthly Frequency',
  'Repeat Rate Funnel',
  'Power Users',
  'Order Count Cohorts',
  'L2 Repeat Patterns',
] as const

type SubTab = (typeof SUB_TABS)[number]

const COHORT_SUB_TABS = ['2', '3', '4', '5', '5+'] as const
type CohortSubTab = (typeof COHORT_SUB_TABS)[number]

const COHORT_TAB_LABELS: Record<CohortSubTab, string> = {
  '2': '2 orders',
  '3': '3 orders',
  '4': '4 orders',
  '5': '5 orders',
  '5+': '5+ orders',
}

type L2SortKey = keyof Pick<
  L2RepeatRow,
  'l2Tag' | 'totalBuyers' | 'repeaters' | 'repeatRate' | 'avgOrdersRepeaters' | 'avgDaysToRepeat' | 'avgFirstOrderAOV'
>

function computeLatestMonthDistribution(boardOrders: Order[]) {
  if (boardOrders.length === 0) return { latestMonthDistribution: [], latestMonthLabel: '' }

  const byMonth = new Map<string, Order[]>()
  for (const order of boardOrders) {
    const month = format(toZonedTime(new Date(order.created_at), IST), 'yyyy-MM')
    const list = byMonth.get(month) ?? []
    list.push(order)
    byMonth.set(month, list)
  }

  const months = Array.from(byMonth.keys()).sort()
  const latestMonth = months[months.length - 1]
  if (!latestMonth) return { latestMonthDistribution: [], latestMonthLabel: '' }

  const monthOrders = byMonth.get(latestMonth)!
  const customerCounts = new Map<string | number, number>()
  for (const o of monthOrders) {
    const id = o.customer?.id
    if (!id) continue
    customerCounts.set(id, (customerCounts.get(id) ?? 0) + 1)
  }

  const buckets = ['1', '2', '3', '4', '5+'] as const
  const distribution = buckets.map((orderCount) => {
    let customers = 0
    for (const count of customerCounts.values()) {
      if (orderCount === '5+' && count >= 5) customers++
      else if (orderCount === String(count)) customers++
    }
    return { orderCount, customers }
  })

  const label = format(toZonedTime(new Date(`${latestMonth}-01`), IST), 'MMM yyyy')
  return { latestMonthDistribution: distribution, latestMonthLabel: label }
}

const PctCell = memo(function PctCell({
  pct,
  count,
  pending,
}: {
  pct: number | null
  count: number | null
  pending?: boolean
}) {
  if (pending && count == null) {
    return <span className="text-xs italic text-slate-400">pending…</span>
  }
  if (pct == null || count == null) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <span className={`inline-block rounded px-2 py-0.5 tabular-nums text-xs ${powerPctBg(pct)} ${powerPctColor(pct)}`}>
      {count.toLocaleString('en-IN')} ({pct.toFixed(1)}%)
      {pending ? <span className="ml-1 font-normal text-slate-400">*</span> : null}
    </span>
  )
})

const SubTabBar = memo(function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly string[]
  active: string
  onChange: (tab: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-kiddo-border pb-3">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            active === tab
              ? 'bg-[#00A86B] font-medium text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
})

const MonthlyFrequencyLineChart = memo(function MonthlyFrequencyLineChart({
  boardOrders,
}: {
  boardOrders: Order[]
}) {
  const monthlyFrequency = useMemo(() => computeMonthlyFrequency(boardOrders), [boardOrders])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={monthlyFrequency}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => v.toFixed(2)} />
        <Line
          type="monotone"
          dataKey="avgOrdersPerUser"
          stroke="#00A86B"
          strokeWidth={2}
          dot={false}
          name="Avg orders / user"
        />
      </LineChart>
    </ResponsiveContainer>
  )
})

const MonthlyFrequencyDistributionChart = memo(function MonthlyFrequencyDistributionChart({
  boardOrders,
}: {
  boardOrders: Order[]
}) {
  const { latestMonthDistribution, latestMonthLabel } = useMemo(
    () => computeLatestMonthDistribution(boardOrders),
    [boardOrders]
  )

  return (
    <>
      <p className="mb-4 text-xs text-slate-500">Customers by orders placed in {latestMonthLabel}</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={latestMonthDistribution}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="orderCount" tick={{ fontSize: 10 }} label={{ value: 'Orders', position: 'insideBottom', offset: -2, fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="customers" fill="#00A86B" name="Customers" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
})

const MonthlyFrequencyPanel = memo(function MonthlyFrequencyPanel({
  orders,
}: {
  orders: Order[]
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <BoardSection
        title="Avg orders per active customer"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
      >
        {(boardOrders) => <MonthlyFrequencyLineChart boardOrders={boardOrders} />}
      </BoardSection>
      <BoardSection
        title="Order count distribution"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
      >
        {(boardOrders) => <MonthlyFrequencyDistributionChart boardOrders={boardOrders} />}
      </BoardSection>
    </div>
  )
})

const RepeatFunnelContent = memo(function RepeatFunnelContent({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const [view, setView] = useState<'funnel' | 'table'>('funnel')
  const funnel = useMemo(() => {
    const summaries = buildCustomerSummaries(boardOrders, productTagsMap)
    return computeRepeatFunnel(summaries)
  }, [boardOrders, productTagsMap])
  const maxCustomers = funnel[0]?.customers ?? 1

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex gap-1 rounded-md border border-kiddo-border p-0.5">
          {(['funnel', 'table'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                view === mode ? 'bg-[#00A86B] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {view === 'funnel' ? (
        <div className="mx-auto max-w-2xl space-y-3">
          {funnel.map((stage) => {
            const widthPct = maxCustomers > 0 ? (stage.customers / maxCustomers) * 100 : 0
            return (
              <div key={stage.stage}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{stage.stage}</span>
                  <span className="tabular-nums text-slate-500">
                    {stage.customers.toLocaleString('en-IN')}
                    {stage.pctFromPrevious != null && (
                      <span className="ml-2 text-slate-400">({stage.pctFromPrevious.toFixed(1)}% of prev)</span>
                    )}
                  </span>
                </div>
                <div className="h-9 rounded bg-slate-100">
                  <div
                    className="flex h-full items-center justify-center rounded bg-[#00A86B] text-xs font-medium text-white transition-all"
                    style={{ width: `${Math.max(widthPct, stage.customers > 0 ? 8 : 0)}%` }}
                  >
                    {stage.pctFromTotal.toFixed(1)}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-4">Stage</th>
                <th className="pb-2 pr-4 text-right">Customers</th>
                <th className="pb-2 pr-4 text-right">% from previous</th>
                <th className="pb-2 text-right">% from total</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((stage) => (
                <tr key={stage.stage} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium">{stage.stage}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{stage.customers.toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {stage.pctFromPrevious != null ? `${stage.pctFromPrevious.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">{stage.pctFromTotal.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <TableSummaryFooter
              cells={[
                { type: 'text', values: [] },
                {
                  type: 'count',
                  values: funnel.length > 0 ? [funnel[0]!.customers] : [],
                  label: funnel.length > 0 ? funnel[0]!.customers.toLocaleString('en-IN') : '—',
                },
                {
                  type: 'percentage',
                  values: funnel
                    .map((s) => s.pctFromPrevious)
                    .filter((p): p is number => p != null),
                },
                { type: 'percentage', values: funnel.map((s) => s.pctFromTotal) },
              ]}
            />
          </table>
        </div>
      )}
    </>
  )
})

const RepeatFunnelPanel = memo(function RepeatFunnelPanel({
  orders,
  productTagsMap,
}: {
  orders: Order[]
  productTagsMap: ProductTagsMap
}) {
  return (
    <BoardSection
      title="Repeat rate funnel"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
    >
      {(boardOrders) => <RepeatFunnelContent boardOrders={boardOrders} productTagsMap={productTagsMap} />}
    </BoardSection>
  )
})

const PowerUsersLineChart = memo(function PowerUsersLineChart({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const chartData = useMemo(() => {
    const dailyPower = computeDailyPowerUsers(boardOrders, productTagsMap)
    return [...dailyPower].reverse()
  }, [boardOrders, productTagsMap])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} unit="%" />
        <Tooltip formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : 'pending…')} />
        <Line
          type="monotone"
          dataKey="powerUsers7Pct"
          stroke="#00A86B"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          name="Power users (7d)"
        />
      </LineChart>
    </ResponsiveContainer>
  )
})

const PowerUsersCohortsTable = memo(function PowerUsersCohortsTable({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const dailyPower = useMemo(
    () => computeDailyPowerUsers(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )

  const closedPctRows = dailyPower.filter((r) => r.powerUsers7Pct != null)
  const within15Rows = dailyPower.filter((r) => r.within15Pct != null)
  const within30Rows = dailyPower.filter((r) => r.within30Pct != null)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4 text-right">1st time orders</th>
              <th className="pb-2 pr-4 text-right">Power users (7d)</th>
              <th className="pb-2 pr-4 text-right">≤15d</th>
              <th className="pb-2 text-right">≤30d</th>
            </tr>
          </thead>
          <tbody>
            {dailyPower.map((row) => (
              <tr key={row.dateKey} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-medium">{row.date}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.firstTimeOrders.toLocaleString('en-IN')}</td>
                <td className="py-2 pr-4 text-right">
                  <PctCell pct={row.powerUsers7Pct} count={row.powerUsers7} pending={row.pending7} />
                </td>
                <td className="py-2 pr-4 text-right">
                  <PctCell pct={row.within15Pct} count={row.within15} />
                </td>
                <td className="py-2 text-right">
                  <PctCell pct={row.within30Pct} count={row.within30} />
                </td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [] },
              { type: 'count', values: dailyPower.map((r) => r.firstTimeOrders) },
              { type: 'percentage', values: closedPctRows.map((r) => r.powerUsers7Pct!) },
              { type: 'percentage', values: within15Rows.map((r) => r.within15Pct!) },
              { type: 'percentage', values: within30Rows.map((r) => r.within30Pct!) },
            ]}
          />
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        * 7-day window not yet fully closed. Final number may increase.
      </p>
    </>
  )
})

const PowerUsersPanel = memo(function PowerUsersPanel({
  orders,
  productTagsMap,
}: {
  orders: Order[]
  productTagsMap: ProductTagsMap
}) {
  return (
    <div className="space-y-6">
      <BoardSection
        title="Power user rate (7-day window)"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="30d"
      >
        {(boardOrders) => <PowerUsersLineChart boardOrders={boardOrders} productTagsMap={productTagsMap} />}
      </BoardSection>

      <BoardSection
        title="Daily first-time cohorts"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="30d"
      >
        {(boardOrders) => <PowerUsersCohortsTable boardOrders={boardOrders} productTagsMap={productTagsMap} />}
      </BoardSection>
    </div>
  )
})

function statsForCohort(cohort: CustomerSummary[], allCustomers: number) {
  return {
    customers: cohort.length,
    pctOfAll: allCustomers > 0 ? (cohort.length / allCustomers) * 100 : 0,
    avgFirstAov: avg(cohort.map((c) => parseMoney(c.orders[0]?.total_price ?? '0'))),
    topL1: cohort[0]?.primaryCategory ?? '—',
    appPct: cohort.length > 0 ? (cohort.filter((c) => c.primaryChannel === 'app').length / cohort.length) * 100 : 0,
    avgDaysToSecond: avg(cohort.filter((c) => c.daysToSecondOrder != null).map((c) => c.daysToSecondOrder!)),
    pctSecond7d:
      cohort.length > 0
        ? (cohort.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 7).length / cohort.length) * 100
        : 0,
  }
}

const OrderCountCohortsContent = memo(function OrderCountCohortsContent({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const [cohortTab, setCohortTab] = useState<CohortSubTab>('2')
  const orderCountCohorts = useMemo(() => {
    const summaries = buildCustomerSummaries(boardOrders, productTagsMap)
    return computeOrderCountCohortComparison(summaries)
  }, [boardOrders, productTagsMap])

  const totalCustomers = useMemo(
    () => orderCountCohorts.reduce((s, r) => s + r.customers, 0),
    [orderCountCohorts]
  )

  const activeStats = useMemo(() => {
    if (cohortTab === '5') {
      const fivePlus = orderCountCohorts.find((r) => r.label === '5+ orders')
      const cohort = (fivePlus?.cohort ?? []).filter((c) => c.totalOrders === 5)
      return statsForCohort(cohort, totalCustomers)
    }
    const label = COHORT_TAB_LABELS[cohortTab]
    const row = orderCountCohorts.find((r) => r.label === label)
    if (!row) return null
    return {
      customers: row.customers,
      pctOfAll: row.pctOfAll,
      avgFirstAov: row.avgFirstAov,
      topL1: row.topL1,
      appPct: row.appPct,
      avgDaysToSecond: row.avgDaysToSecond,
      pctSecond7d: row.pctSecond7d,
    }
  }, [cohortTab, orderCountCohorts, totalCustomers])

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-4">Bucket</th>
              <th className="pb-2 pr-4 text-right">Customers</th>
              <th className="pb-2 pr-4 text-right">% of all</th>
              <th className="pb-2 pr-4 text-right">Avg 1st AOV</th>
              <th className="pb-2 pr-4">Top L1</th>
              <th className="pb-2 pr-4 text-right">App %</th>
              <th className="pb-2 pr-4 text-right">Avg days to 2nd</th>
              <th className="pb-2 text-right">2nd within 7d</th>
            </tr>
          </thead>
          <tbody>
            {orderCountCohorts.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-medium">{row.label}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.customers.toLocaleString('en-IN')}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.pctOfAll.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatINR(row.avgFirstAov)}</td>
                <td className="py-2 pr-4">{row.topL1}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.appPct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {row.avgDaysToSecond > 0 ? row.avgDaysToSecond.toFixed(1) : '—'}
                </td>
                <td className="py-2 text-right tabular-nums">{row.pctSecond7d.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [] },
              { type: 'count', values: orderCountCohorts.map((r) => r.customers) },
              { type: 'percentage', values: orderCountCohorts.map((r) => r.pctOfAll) },
              { type: 'aov', values: orderCountCohorts.map((r) => r.avgFirstAov) },
              { type: 'text', values: [] },
              { type: 'percentage', values: orderCountCohorts.map((r) => r.appPct) },
              { type: 'days', values: orderCountCohorts.filter((r) => r.avgDaysToSecond > 0).map((r) => r.avgDaysToSecond) },
              { type: 'percentage', values: orderCountCohorts.map((r) => r.pctSecond7d) },
            ]}
          />
        </table>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <SubTabBar tabs={COHORT_SUB_TABS} active={cohortTab} onChange={(t) => setCohortTab(t as CohortSubTab)} />
        {activeStats ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Customers" value={activeStats.customers.toLocaleString('en-IN')} />
            <StatCard label="% of all" value={`${activeStats.pctOfAll.toFixed(1)}%`} />
            <StatCard label="Avg 1st AOV" value={formatINR(activeStats.avgFirstAov)} />
            <StatCard label="Top L1" value={activeStats.topL1} />
            <StatCard label="App %" value={`${activeStats.appPct.toFixed(1)}%`} />
            <StatCard
              label="Avg days to 2nd"
              value={activeStats.avgDaysToSecond > 0 ? activeStats.avgDaysToSecond.toFixed(1) : '—'}
            />
            <StatCard label="2nd within 7d" value={`${activeStats.pctSecond7d.toFixed(1)}%`} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No customers in this bucket.</p>
        )}
      </div>
    </div>
  )
})

const OrderCountCohortsPanel = memo(function OrderCountCohortsPanel({
  orders,
  productTagsMap,
}: {
  orders: Order[]
  productTagsMap: ProductTagsMap
}) {
  return (
    <BoardSection
      title="Order count cohort comparison"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
    >
      {(boardOrders) => (
        <OrderCountCohortsContent boardOrders={boardOrders} productTagsMap={productTagsMap} />
      )}
    </BoardSection>
  )
})

const L2RepeatBarChart = memo(function L2RepeatBarChart({ l2Repeat }: { l2Repeat: L2RepeatRow[] }) {
  const chartData = useMemo(
    () => l2Repeat.slice(0, 20).map((r) => ({ name: r.l2Tag, repeatRate: r.repeatRate })),
    [l2Repeat]
  )

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" unit="%" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Bar dataKey="repeatRate" fill="#00A86B" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})

const L2RepeatPatternsTable = memo(function L2RepeatPatternsTable({ l2Repeat }: { l2Repeat: L2RepeatRow[] }) {
  const [sortKey, setSortKey] = useState<L2SortKey>('repeatRate')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const rows = [...l2Repeat]
    rows.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return rows
  }, [l2Repeat, sortKey, sortAsc])

  const handleSort = (key: L2SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(key === 'l2Tag')
    }
  }

  const SortHeader = ({ label, col }: { label: string; col: L2SortKey }) => (
    <th className="cursor-pointer pb-2 pr-4 hover:text-slate-600" onClick={() => handleSort(col)}>
      {label}
      {sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const daysRows = sorted.filter((r) => r.avgDaysToRepeat > 0)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-slate-400">
            <SortHeader label="L2" col="l2Tag" />
            <th className="pb-2 pr-4">L1</th>
            <SortHeader label="Buyers" col="totalBuyers" />
            <SortHeader label="Repeaters" col="repeaters" />
            <SortHeader label="Repeat %" col="repeatRate" />
            <SortHeader label="Avg orders" col="avgOrdersRepeaters" />
            <SortHeader label="Days to repeat" col="avgDaysToRepeat" />
            <SortHeader label="1st AOV" col="avgFirstOrderAOV" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.l2Tag} className="border-t border-slate-100">
              <td className="py-2 pr-4 font-medium">{row.l2Tag}</td>
              <td className="py-2 pr-4 text-slate-500">{row.l1}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{row.totalBuyers.toLocaleString('en-IN')}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{row.repeaters.toLocaleString('en-IN')}</td>
              <td className="py-2 pr-4 text-right tabular-nums font-medium">{row.repeatRate.toFixed(1)}%</td>
              <td className="py-2 pr-4 text-right tabular-nums">{row.avgOrdersRepeaters.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {row.avgDaysToRepeat > 0 ? row.avgDaysToRepeat.toFixed(1) : '—'}
              </td>
              <td className="py-2 text-right tabular-nums">{formatINR(row.avgFirstOrderAOV)}</td>
            </tr>
          ))}
        </tbody>
        <TableSummaryFooter
          cells={[
            { type: 'text', values: [] },
            { type: 'text', values: [] },
            { type: 'count', values: sorted.map((r) => r.totalBuyers) },
            { type: 'count', values: sorted.map((r) => r.repeaters) },
            { type: 'percentage', values: sorted.map((r) => r.repeatRate) },
            { type: 'orders', values: sorted.map((r) => r.avgOrdersRepeaters) },
            { type: 'days', values: daysRows.map((r) => r.avgDaysToRepeat) },
            { type: 'aov', values: sorted.map((r) => r.avgFirstOrderAOV) },
          ]}
        />
      </table>
    </div>
  )
})

const L2RepeatPanel = memo(function L2RepeatPanel({
  orders,
  productTagsMap,
}: {
  orders: Order[]
  productTagsMap: ProductTagsMap
}) {
  return (
    <div className="space-y-6">
      <BoardSection
        title="Top 20 L2 categories by repeat rate"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
      >
        {(boardOrders) => {
          const l2Repeat = computeL2RepeatRates(boardOrders, productTagsMap)
          return <L2RepeatBarChart l2Repeat={l2Repeat} />
        }}
      </BoardSection>

      <BoardSection
        title="L2 repeat patterns"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
      >
        {(boardOrders) => {
          const l2Repeat = computeL2RepeatRates(boardOrders, productTagsMap)
          return <L2RepeatPatternsTable l2Repeat={l2Repeat} />
        }}
      </BoardSection>
    </div>
  )
})

const StatCard = memo(function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
})

function RetentionTabInner({ orders, productTagsMap }: RetentionTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('First Order Signals')

  if (orders.length === 0) {
    return <EmptyState message="No orders in the selected range for retention analysis." />
  }

  if (activeSubTab === 'First Order Signals') {
    return (
      <div className="space-y-6">
        <SubTabBar tabs={SUB_TABS} active={activeSubTab} onChange={(t) => setActiveSubTab(t as SubTab)} />
        <FirstOrderSignalsPanel orders={orders} productTagsMap={productTagsMap} />
      </div>
    )
  }

  if (activeSubTab === 'Churn Risk') {
    return (
      <div className="space-y-6">
        <SubTabBar tabs={SUB_TABS} active={activeSubTab} onChange={(t) => setActiveSubTab(t as SubTab)} />
        <ChurnRiskPanel orders={orders} productTagsMap={productTagsMap} />
      </div>
    )
  }

  if (activeSubTab === 'Intervention Timing') {
    return (
      <div className="space-y-6">
        <SubTabBar tabs={SUB_TABS} active={activeSubTab} onChange={(t) => setActiveSubTab(t as SubTab)} />
        <InterventionTimingPanel orders={orders} productTagsMap={productTagsMap} />
      </div>
    )
  }

  if (activeSubTab === 'LTV Projections') {
    return (
      <div className="space-y-6">
        <SubTabBar tabs={SUB_TABS} active={activeSubTab} onChange={(t) => setActiveSubTab(t as SubTab)} />
        <LtvProjectionsPanel orders={orders} productTagsMap={productTagsMap} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SubTabBar tabs={SUB_TABS} active={activeSubTab} onChange={(t) => setActiveSubTab(t as SubTab)} />

      {activeSubTab === 'Monthly Frequency' && <MonthlyFrequencyPanel orders={orders} />}

      {activeSubTab === 'Repeat Rate Funnel' && (
        <RepeatFunnelPanel orders={orders} productTagsMap={productTagsMap} />
      )}

      {activeSubTab === 'Power Users' && (
        <PowerUsersPanel orders={orders} productTagsMap={productTagsMap} />
      )}

      {activeSubTab === 'Order Count Cohorts' && (
        <OrderCountCohortsPanel orders={orders} productTagsMap={productTagsMap} />
      )}

      {activeSubTab === 'L2 Repeat Patterns' && (
        <L2RepeatPanel orders={orders} productTagsMap={productTagsMap} />
      )}
    </div>
  )
}

export const RetentionTab = memo(RetentionTabInner)
