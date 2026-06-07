import type { DistanceBand, Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getDistanceBand } from './geography'
import { classifyOrder, classifyOrderPrimary } from './taxonomy'
import { buildFirstOrderIdSet, isFirstTimeOrder, isNonEssentialOrder } from './orderAnalysis'
import { getHourIST } from './dates'
import type { L1Tag } from './taxonomy'

export type MetricFilterId =
  | 'totalOrders'
  | 'aov'
  | 'firstTimeOrders'
  | 'repeatOrders'
  | 'nonEssentialOrders'
  | 'pctNonEssential'
  | 'totalOrdersGrowth'
  | 'firstTimeGrowth'
  | 'repeatGrowth'
  | 'spendIncrease'
  | 'cac'
  | 'gmv'
  | 'newCustomers'
  | 'avgItems'
  | string

export interface DrillFilterOptions {
  metricId?: MetricFilterId
  category?: string
  channel?: 'app' | 'website'
  geoBand?: DistanceBand
  hour?: number
  productName?: string
  allOrders?: Order[]
}

export function filterOrdersForMetric(
  orders: Order[],
  productTagsMap: ProductTagsMap,
  options: DrillFilterOptions = {}
): Order[] {
  const { metricId, category, channel, geoBand, hour, productName } = options
  const allOrders = options.allOrders ?? orders
  const firstOrderIds = buildFirstOrderIdSet(allOrders)

  let result = orders

  if (metricId) {
    switch (metricId) {
      case 'firstTimeOrders':
      case 'newCustomers':
        result = result.filter((o) => isFirstTimeOrder(o, firstOrderIds))
        break
      case 'repeatOrders':
        result = result.filter((o) => !isFirstTimeOrder(o, firstOrderIds))
        break
      case 'nonEssentialOrders':
      case 'pctNonEssential':
        result = result.filter((o) => isNonEssentialOrder(o, productTagsMap))
        break
      default:
        break
    }
  }

  if (category) {
    result = result.filter((o) => {
      const primary = classifyOrderPrimary(o, productTagsMap)
      const key = primary === 'Uncategorized' ? 'Uncategorized' : primary
      if (category === key) return true
      return classifyOrder(o, productTagsMap).includes(category as L1Tag)
    })
  }

  if (channel) {
    result = result.filter((o) => getOrderChannel(o) === channel)
  }

  if (geoBand) {
    result = result.filter((o) => getDistanceBand(o) === geoBand)
  }

  if (hour != null) {
    result = result.filter((o) => getHourIST(o.created_at) === hour)
  }

  if (productName) {
    result = result.filter((o) =>
      (o.line_items ?? []).some(
        (li) => (li.product_title ?? li.title ?? 'Unknown') === productName
      )
    )
  }

  return result
}
