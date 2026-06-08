import { useEffect } from 'react'
import { useDashboardStore } from '../store'
import { buildCustomerSummaries } from '../utils/customerSummary'

/** Rebuild customer summaries + first-order DNA whenever orders or tags change. */
export function useCustomerSummariesSync() {
  const rawOrders = useDashboardStore((s) => s.rawOrders)
  const productTagsMap = useDashboardStore((s) => s.productTagsMap)
  const setCustomerSummaries = useDashboardStore((s) => s.setCustomerSummaries)

  useEffect(() => {
    if (rawOrders.length === 0) {
      setCustomerSummaries([])
      return
    }
    const summaries = buildCustomerSummaries(rawOrders, productTagsMap)
    const repeatCount = summaries.filter((c) => c.totalOrders >= 2).length
    console.log('[Retention] customers with 2+ orders:', repeatCount)
    if (summaries.length >= 3) {
      console.log(
        '[Retention] sample firstOrderDNA:',
        summaries.slice(0, 3).map((c) => ({
          phone: c.phone,
          orders: c.totalOrders,
          dna: c.firstOrderDNA,
        }))
      )
    }
    setCustomerSummaries(summaries)
  }, [rawOrders, productTagsMap, setCustomerSummaries])
}
