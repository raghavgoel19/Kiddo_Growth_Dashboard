import { useMemo } from 'react'
import type { Order } from '../api/types'
import { useDashboardContext } from '../context/DashboardContext'
import { computeComparePeriod } from '../utils/comparePeriod'
import { filterTestOrders } from '../utils/testUserFilter'
import type { OrderStatus } from '../api/types'

function applyStatusFilter(orders: Order[], statuses: OrderStatus[]): Order[] {
  if (statuses.includes('all') || statuses.length === 0) return orders
  return orders.filter((o) => {
    if (statuses.includes('cancelled') && o.cancelled_at) return true
    return statuses.includes(o.financial_status as OrderStatus)
  })
}

export function useTabCompare() {
  const { filters, allOrders, filteredOrders } = useDashboardContext()

  const compareResult = useMemo(
    () => computeComparePeriod(allOrders, filters),
    [allOrders, filters]
  )

  const compareOrders = useMemo(() => {
    if (!compareResult?.compareOrders.length) return []
    let result = compareResult.compareOrders
    result = applyStatusFilter(result, filters.orderStatuses)
    result = filterTestOrders(result, filters.hideTestUsers)
    return result
  }, [compareResult, filters.orderStatuses, filters.hideTestUsers])

  return {
    orders: filteredOrders,
    compareOrders,
    compareEnabled: filters.compareEnabled && compareOrders.length > 0,
    currentLabel: compareResult?.currentLabel ?? 'Current',
    compareLabel: compareResult?.compareLabel ?? 'Compare',
  }
}
