import { memo, useMemo, useState } from 'react'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { buildCustomerSummaries } from '../../utils/customerSummary'
import {
  churnScoreBadgeClass,
  churnScoreLabel,
  computeChurnRiskFeed,
  estimateGmvAtRisk,
  filterByRiskLevel,
  type ChurnRiskFilter,
} from '../../utils/churnRisk'
import { formatINR, displayPhone } from '../../utils/formatters'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { ExportButton } from '../shared/ExportButton'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'

type SortKey = 'score' | 'lastOrder' | 'ltv' | 'orders'

interface ChurnRiskPanelProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const ChurnRiskFeed = memo(function ChurnRiskFeed({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()
  const tags = productTagsMap
  const [riskFilter, setRiskFilter] = useState<ChurnRiskFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('score')

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, tags),
    [boardOrders, tags]
  )

  const allAtRisk = useMemo(
    () => computeChurnRiskFeed(summaries, tags, 40),
    [summaries, tags]
  )

  const filtered = useMemo(() => {
    let rows = filterByRiskLevel(allAtRisk, riskFilter)
    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'lastOrder':
          return b.customer.daysSinceLastOrder - a.customer.daysSinceLastOrder
        case 'ltv':
          return b.customer.totalSpent - a.customer.totalSpent
        case 'orders':
          return b.customer.totalOrders - a.customer.totalOrders
        default:
          return b.score - a.score
      }
    })
    return rows
  }, [allAtRisk, riskFilter, sortKey])

  const gmvAtRisk = useMemo(() => estimateGmvAtRisk(filtered), [filtered])

  const openCustomerDrill = (customerId: string, phone: string | null) => {
    const drillOrders = allOrders.filter((o) => o.customer?.id === customerId)
    openDrillDown({
      title: displayPhone(phone),
      subtitle: 'At-risk customer orders',
      orders: drillOrders,
    })
  }

  if (summaries.filter((c) => c.totalOrders >= 2).length === 0) {
    return <EmptyState message="Need repeat customers to compute churn risk scores." />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {filtered.length.toLocaleString('en-IN')} customers at risk · Est.{' '}
        <span className="font-semibold">{formatINR(gmvAtRisk)}</span> GMV at risk (based on avg LTV
        projection)
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Risk level:</span>
        {(
          [
            ['critical', '🔴 Critical 80+'],
            ['high', '🟠 High 60+'],
            ['medium', '🟡 Medium 40+'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRiskFilter(key)}
            className={`rounded-full px-3 py-1 text-xs ${
              riskFilter === key ? 'bg-[#00A86B] text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Sort by:</span>
        {(
          [
            ['score', 'Score'],
            ['lastOrder', 'Last order'],
            ['ltv', 'LTV'],
            ['orders', 'Orders'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={`rounded-full px-3 py-1 text-xs ${
              sortKey === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <ExportButton
          label="Export CSV"
          onExport={() =>
            downloadCsv(
              exportFilename('churn_risk'),
              ['Phone', 'Score', 'Orders', 'LTV', 'Days since last', 'Signals'],
              filtered.map((r) => [
                r.customer.phone ?? '',
                r.score,
                r.customer.totalOrders,
                r.customer.totalSpent,
                r.customer.daysSinceLastOrder,
                r.signals.map((s) => s.label).join('; '),
              ])
            )
          }
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No customers match this risk filter." />
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 100).map((row) => (
            <button
              key={row.customer.id}
              type="button"
              onClick={() => openCustomerDrill(row.customer.id, row.customer.phone)}
              className="w-full rounded-card border border-kiddo-border bg-white p-4 text-left transition-colors hover:border-[#00A86B]/40 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{displayPhone(row.customer.phone)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.customer.totalOrders} orders · {formatINR(row.customer.totalSpent)} LTV · Last
                    order: {row.customer.daysSinceLastOrder} days ago
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${churnScoreBadgeClass(row.score)}`}
                >
                  {churnScoreLabel(row.score)} · {row.score}
                </span>
              </div>
              <ul className="mt-3 space-y-1">
                {row.signals.map((s) => (
                  <li key={s.type} className="text-xs text-slate-600">
                    ⚠ {s.label}
                  </li>
                ))}
              </ul>
            </button>
          ))}
          {filtered.length > 100 && (
            <p className="text-center text-xs text-slate-400">
              Showing top 100 of {filtered.length.toLocaleString('en-IN')} — export CSV for full list
            </p>
          )}
        </div>
      )}
    </div>
  )
})

export const ChurnRiskPanel = memo(function ChurnRiskPanel({
  orders,
  productTagsMap,
}: ChurnRiskPanelProps) {
  return (
    <BoardSection
      title="Churn risk feed"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
    >
      {(boardOrders) => (
        <ChurnRiskFeed boardOrders={boardOrders} productTagsMap={productTagsMap} />
      )}
    </BoardSection>
  )
})
