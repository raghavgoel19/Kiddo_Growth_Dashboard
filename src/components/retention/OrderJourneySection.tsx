import { memo, useMemo } from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { buildCustomerSummaries } from '../../utils/customerSummary'
import {
  buildOrderJourneyFlows,
  customersMatchingFlow,
  flowsToSankeyData,
  generateJourneyInsights,
} from '../../utils/orderJourney'
import { BoardSection } from '../shared/BoardSection'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'

interface OrderJourneySectionProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const OrderJourneyContent = memo(function OrderJourneyContent({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const flows = useMemo(
    () => buildOrderJourneyFlows(summaries, productTagsMap),
    [summaries, productTagsMap]
  )
  const sankeyData = useMemo(() => flowsToSankeyData(flows, 15), [flows])
  const insights = useMemo(
    () => generateJourneyInsights(flows, summaries, productTagsMap),
    [flows, summaries, productTagsMap]
  )
  const topFlows = flows.slice(0, 15)

  const openFlowDrill = (flowKey: string) => {
    const matched = customersMatchingFlow(summaries, productTagsMap, flowKey)
    const idSet = new Set(matched.map((c) => c.id))
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title: `Journey: ${flowKey.replace('→', ' → ')}`,
      subtitle: `${matched.length.toLocaleString('en-IN')} customers`,
      orders: drillOrders,
    })
  }

  if (flows.length === 0) {
    return <p className="text-sm text-slate-500">Need customers with 2+ orders to map category flows.</p>
  }

  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        How customers move between categories across their first 3 orders. Top 15 flows shown.
      </p>

      {sankeyData.links.length > 0 ? (
        <ResponsiveContainer width="100%" height={360}>
          <Sankey
            data={sankeyData}
            node={{ fill: '#00A86B', stroke: '#047857' }}
            link={{ stroke: '#86EFAC', strokeOpacity: 0.6 }}
            nodePadding={24}
            margin={{ top: 10, right: 120, bottom: 10, left: 120 }}
            onClick={(item: { flowKey?: string; name?: string }) => {
              if (item && 'flowKey' in item && item.flowKey) openFlowDrill(item.flowKey)
            }}
          >
            <Tooltip
              formatter={(value: number, _name, props) => {
                const payload = props?.payload as { flowKey?: string; source?: { name?: string }; target?: { name?: string } }
                if (payload?.flowKey) {
                  return [`${value.toLocaleString('en-IN')} customers`, payload.flowKey.replace('→', ' → ')]
                }
                return [value, payload?.source?.name ?? payload?.target?.name ?? '']
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Flow</th>
              <th className="pb-2 text-right">Customers</th>
            </tr>
          </thead>
          <tbody>
            {topFlows.map((f) => (
              <tr
                key={f.key}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => openFlowDrill(f.key)}
              >
                <td className="py-2">
                  {f.from} → {f.to}
                </td>
                <td className="py-2 text-right tabular-nums">{f.count.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [] },
              { type: 'count', values: topFlows.map((f) => f.count) },
            ]}
          />
        </table>
      </div>

      <div className="mt-4 space-y-2">
        {insights.map((text) => (
          <p key={text} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {text}
          </p>
        ))}
      </div>
    </>
  )
})

export const OrderJourneySection = memo(function OrderJourneySection({
  orders,
  productTagsMap,
}: OrderJourneySectionProps) {
  return (
    <BoardSection
      title="Order journeys (L1 category flows)"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
      boardFilterMode="first_order_cohort"
    >
      {(boardOrders) => (
        <OrderJourneyContent boardOrders={boardOrders} productTagsMap={productTagsMap} />
      )}
    </BoardSection>
  )
})
