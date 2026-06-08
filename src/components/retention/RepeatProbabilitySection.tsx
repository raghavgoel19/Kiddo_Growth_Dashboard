import { memo, useMemo, useState } from 'react'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { buildCustomerSummaries } from '../../utils/customerSummary'
import { computeCorrelationMatrix } from '../../utils/correlationMatrix'
import {
  daysSinceFirstOrder,
  formatFirstOrderLine,
  repeatScoreBadgeClass,
  repeatScoreEmoji,
  scoreSingleOrderCustomers,
  summarizeRepeatProbability,
} from '../../utils/repeatProbability'
import { displayPhone } from '../../utils/formatters'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { ExportButton } from '../shared/ExportButton'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'

type ScoreFilter = 'all' | 'high' | 'medium' | 'low'

interface RepeatProbabilitySectionProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const RepeatProbabilityContent = memo(function RepeatProbabilityContent({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const matrix = useMemo(() => computeCorrelationMatrix(summaries), [summaries])
  const scored = useMemo(
    () => scoreSingleOrderCustomers(summaries, matrix),
    [summaries, matrix]
  )
  const summary = useMemo(() => summarizeRepeatProbability(scored, 30), [scored])

  const filtered = useMemo(() => {
    switch (scoreFilter) {
      case 'high':
        return scored.filter((r) => r.repeatProbability.score >= 60)
      case 'medium':
        return scored.filter((r) => r.repeatProbability.score >= 35 && r.repeatProbability.score < 60)
      case 'low':
        return scored.filter((r) => r.repeatProbability.score < 35)
      default:
        return scored
    }
  }, [scored, scoreFilter])

  const openCustomerDrill = (customerId: string, phone: string | null) => {
    const drillOrders = allOrders.filter((o) => o.customer?.id === customerId)
    openDrillDown({
      title: displayPhone(phone),
      subtitle: 'Single-order customer',
      orders: drillOrders,
    })
  }

  if (scored.length === 0) {
    return <EmptyState message="No single-order customers in the selected board range." />
  }

  return (
    <div className="space-y-4">
      {summary.total > 0 ? (
        <p className="text-sm text-slate-700">
          Of your last 30 days&apos; new customers —{' '}
          <span className="font-semibold">{summary.high.toLocaleString('en-IN')}</span> (
          {summary.highPct.toFixed(0)}%) are high probability repeaters.{' '}
          <span className="font-semibold">{summary.medium.toLocaleString('en-IN')}</span> (
          {summary.mediumPct.toFixed(0)}%) are medium.{' '}
          <span className="font-semibold">{summary.low.toLocaleString('en-IN')}</span> (
          {summary.lowPct.toFixed(0)}%) are low.
        </p>
      ) : (
        <p className="text-sm text-slate-500">No new customers in the last 30 days.</p>
      )}
      <p className="text-xs text-slate-500">
        {scored.length.toLocaleString('en-IN')} total single-order customers scored from first-order DNA signals.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Score band:</span>
        {(
          [
            ['high', '🟢 High 60+'],
            ['medium', '🟡 Medium 35–59'],
            ['low', '🔴 Low <35'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScoreFilter(key)}
            className={`rounded-full px-3 py-1 text-xs ${
              scoreFilter === key ? 'bg-[#00A86B] text-white' : 'bg-slate-100 text-slate-600'
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
              exportFilename('repeat_probability'),
              ['Phone', 'Score', 'Prediction', 'Window', 'Days since 1st', 'First order'],
              filtered.map((r) => [
                r.customer.phone ?? '',
                r.repeatProbability.score,
                r.repeatProbability.prediction,
                r.repeatProbability.predictedWindow,
                daysSinceFirstOrder(r.customer),
                formatFirstOrderLine(r.customer.firstOrderDNA),
              ])
            )
          }
        />
      </div>

      <div className="space-y-3">
        {filtered.slice(0, 100).map(({ customer, repeatProbability }) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => openCustomerDrill(customer.id, customer.phone)}
            className="w-full rounded-card border border-kiddo-border bg-white p-4 text-left transition-colors hover:border-[#00A86B]/40 hover:bg-slate-50"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {displayPhone(customer.phone)} · 1 order · {daysSinceFirstOrder(customer)} days ago
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Repeat probability: {repeatProbability.score}% {repeatScoreEmoji(repeatProbability.score)} ·
                  Predicted window: {repeatProbability.predictedWindow}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${repeatScoreBadgeClass(repeatProbability.score)}`}
              >
                {repeatProbability.prediction}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">{formatFirstOrderLine(customer.firstOrderDNA)}</p>
          </button>
        ))}
        {filtered.length > 100 && (
          <p className="text-center text-xs text-slate-400">
            Showing top 100 of {filtered.length.toLocaleString('en-IN')} — export CSV for full list
          </p>
        )}
      </div>
    </div>
  )
})

export const RepeatProbabilitySection = memo(function RepeatProbabilitySection({
  orders,
  productTagsMap,
}: RepeatProbabilitySectionProps) {
  return (
    <BoardSection
      title="Repeat probability score"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
    >
      {(boardOrders) => (
        <RepeatProbabilityContent boardOrders={boardOrders} productTagsMap={productTagsMap} />
      )}
    </BoardSection>
  )
})
