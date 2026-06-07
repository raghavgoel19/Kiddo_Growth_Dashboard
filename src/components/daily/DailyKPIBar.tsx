import { useMemo } from 'react'
import { KPICard } from '../shared/KPICard'
import { buildDailyKPIs, buildKPIsForDateRange, splitOrdersByDay } from '../../utils/dailyMetrics'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext, useDrillDown } from '../../context/DashboardContext'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { filterOrdersThroughSameTimeOfDay, filterOrdersByPeriod } from '../../utils/dates'

interface DailyKPIBarProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const KPI_LABELS: Record<string, string> = {
  totalOrders: 'Total Orders',
  gmv: 'GMV',
  aov: 'AOV',
  firstTimeOrders: '1st Time Orders',
  repeatOrders: 'Repeat Orders',
  avgItems: 'Avg items/order',
}

export function DailyKPIBar({ orders, productTagsMap }: DailyKPIBarProps) {
  const { openDrillDown } = useDrillDown()
  const { allOrders, kpiOverrides, setKpiOverride } = useDashboardContext()
  const baseKpis = useMemo(() => buildDailyKPIs(orders, productTagsMap), [orders, productTagsMap])

  const kpis = useMemo(
    () =>
      baseKpis.map((kpi) => {
        const override = kpiOverrides[kpi.id]
        if (!override || override === 'today') return kpi
        const overridden = buildKPIsForDateRange(orders, productTagsMap, override)
        return overridden.find((k) => k.id === kpi.id) ?? kpi
      }),
    [baseKpis, kpiOverrides, orders, productTagsMap]
  )

  const { today } = useMemo(() => splitOrdersByDay(orders), [orders])

  const drillOrders = (metricId: string) => {
    const override = kpiOverrides[metricId]
    let scoped = today
    if (override && override !== 'today') {
      scoped = filterOrdersByPeriod(orders, override)
    } else {
      scoped = filterOrdersThroughSameTimeOfDay(today)
    }
    return filterOrdersForMetric(scoped, productTagsMap, {
      metricId,
      allOrders: allOrders.length ? allOrders : orders,
    })
  }

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="cursor-pointer"
          onClick={() =>
            openDrillDown({
              title: KPI_LABELS[kpi.id] ?? kpi.label,
              subtitle: `Today · ${kpi.label}`,
              orders: drillOrders(kpi.id),
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              openDrillDown({
                title: KPI_LABELS[kpi.id] ?? kpi.label,
                subtitle: `Today · ${kpi.label}`,
                orders: drillOrders(kpi.id),
              })
            }
          }}
          role="button"
          tabIndex={0}
        >
          <KPICard
            label={kpi.label}
            value={kpi.value}
            vsPrevDay={kpi.vsPrevDay}
            vsPrevWeek={kpi.vsPrevWeek}
            timeLabel={kpi.timeLabel}
            metricKey={kpi.id}
            kpiId={kpi.id}
            dateOverride={kpiOverrides[kpi.id]}
            onDateOverrideChange={(range) => setKpiOverride(kpi.id, range)}
          />
        </div>
      ))}
    </section>
  )
}
