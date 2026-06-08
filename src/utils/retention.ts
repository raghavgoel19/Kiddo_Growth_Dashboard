import type { Order } from '../api/types'

export interface RetentionCell {
  offset: number
  retained: number
  rate: number
}

export interface RetentionRow {
  cohortMonth: string
  cohortSize: number
  periods: RetentionCell[]
}

function monthKeyIST(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(date)
}

function monthOffset(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export function computeRetentionGrid(orders: Order[], maxPeriods = 12): RetentionRow[] {
  const byCustomer = new Map<string, string[]>()

  for (const order of orders) {
    const id = order.customer?.id
    if (!id) continue
    const month = monthKeyIST(new Date(order.created_at))
    const months = byCustomer.get(id) ?? []
    if (!months.includes(month)) months.push(month)
    byCustomer.set(id, months)
  }

  const cohortCustomers = new Map<string, string[]>()
  const cohortFirstMonth = new Map<string, string>()

  for (const [customerId, months] of byCustomer) {
    months.sort()
    const first = months[0]
    cohortFirstMonth.set(customerId, first)
    const list = cohortCustomers.get(first) ?? []
    list.push(customerId)
    cohortCustomers.set(first, list)
  }

  const cohortMonths = Array.from(cohortCustomers.keys()).sort()
  const latestMonth = cohortMonths[cohortMonths.length - 1]

  return cohortMonths.map((cohortMonth) => {
    const customerIds = cohortCustomers.get(cohortMonth) ?? []
    const cohortSize = customerIds.length
    const maxOffset = latestMonth ? monthOffset(cohortMonth, latestMonth) : 0
    const periods: RetentionCell[] = []

    for (let offset = 0; offset <= Math.min(maxOffset, maxPeriods); offset++) {
      const [y, m] = cohortMonth.split('-').map(Number)
      const targetDate = new Date(Date.UTC(y, m - 1 + offset, 1))
      const targetMonth = monthKeyIST(targetDate)

      let retained = 0
      for (const customerId of customerIds) {
        const months = byCustomer.get(customerId) ?? []
        if (months.includes(targetMonth)) retained++
      }

      periods.push({
        offset,
        retained,
        rate: cohortSize > 0 ? (retained / cohortSize) * 100 : 0,
      })
    }

    return { cohortMonth, cohortSize, periods }
  })
}
