import { differenceInCalendarDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { CustomerSummary } from './customerSummary'
import { IST } from './dates'

export interface TimeBucket {
  label: string
  subtitle: string
  minDays: number
  maxDays: number | null
  count: number
  pct: number
  customerIds: string[]
}

export interface CumulativePoint {
  day: number
  label: string
  pct: number
  count: number
}

export interface TimeToValueStats {
  buckets: TimeBucket[]
  cumulative: CumulativePoint[]
  totalWithSecond: number
  neverReturnAfter60Pct: number
  probNeverAt15Days: number
  probNeverAt30Days: number
  optimalInterventionWindow: string
  insights: string[]
}

const BUCKET_DEFS: { label: string; subtitle: string; min: number; max: number | null }[] = [
  { label: 'Day 1–3', subtitle: 'impulse re-order', min: 1, max: 3 },
  { label: 'Day 4–7', subtitle: 'power user window', min: 4, max: 7 },
  { label: 'Day 8–14', subtitle: 're-engagement window', min: 8, max: 14 },
  { label: 'Day 15–30', subtitle: 'monthly window', min: 15, max: 30 },
  { label: 'Day 31–60', subtitle: '', min: 31, max: 60 },
  { label: 'Day 61–90', subtitle: '', min: 61, max: 90 },
  { label: 'Day 91+', subtitle: '', min: 91, max: null },
]

const CUMULATIVE_DAYS = [7, 14, 30, 60] as const

function daysSinceFirstOrder(customer: CustomerSummary): number {
  const today = toZonedTime(new Date(), IST)
  const first = toZonedTime(new Date(customer.firstOrderDate), IST)
  return differenceInCalendarDays(today, first)
}

/** Customers who had not repeated by day N (includes those who later returned after N). */
function silentAtDay(customers: CustomerSummary[], day: number): CustomerSummary[] {
  return customers.filter((c) => {
    const daysSinceFirst = daysSinceFirstOrder(c)
    if (daysSinceFirst < day) return false
    if (c.totalOrders === 1) return true
    if (c.daysToSecondOrder != null && c.daysToSecondOrder > day) return true
    return false
  })
}

function probNeverReturnAtDay(customers: CustomerSummary[], day: number): number {
  const cohort = silentAtDay(customers, day)
  if (cohort.length === 0) return 0
  const never = cohort.filter((c) => c.totalOrders === 1).length
  return (never / cohort.length) * 100
}

export function computeTimeToValueStats(customers: CustomerSummary[]): TimeToValueStats {
  const withSecond = customers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder > 0)
  const totalWithSecond = withSecond.length

  const buckets: TimeBucket[] = BUCKET_DEFS.map((def) => {
    const matched = withSecond.filter((c) => {
      const d = c.daysToSecondOrder!
      if (def.max == null) return d >= def.min
      return d >= def.min && d <= def.max
    })
    return {
      label: def.label,
      subtitle: def.subtitle,
      minDays: def.min,
      maxDays: def.max,
      count: matched.length,
      pct: totalWithSecond > 0 ? (matched.length / totalWithSecond) * 100 : 0,
      customerIds: matched.map((c) => c.id),
    }
  })

  const cumulative: CumulativePoint[] = CUMULATIVE_DAYS.map((day) => {
    const count = withSecond.filter((c) => c.daysToSecondOrder! <= day).length
    return {
      day,
      label: `By day ${day}`,
      pct: totalWithSecond > 0 ? (count / totalWithSecond) * 100 : 0,
      count,
    }
  })

  const allFirstOrders = customers.filter((c) => c.totalOrders >= 1)
  const silent60 = silentAtDay(allFirstOrders, 60)
  const neverAfter60 = silent60.filter((c) => c.totalOrders === 1)
  const neverReturnAfter60Pct =
    silent60.length > 0 ? (neverAfter60.length / silent60.length) * 100 : 0

  const probNeverAt15Days = probNeverReturnAtDay(allFirstOrders, 15)
  const probNeverAt30Days = probNeverReturnAtDay(allFirstOrders, 30)

  const reengagement = buckets.find((b) => b.minDays === 8)
  const optimalInterventionWindow = 'days 8–12'

  const insights: string[] = []
  if (totalWithSecond > 0) {
    const by7 = cumulative.find((c) => c.day === 7)
    const by14 = cumulative.find((c) => c.day === 14)
    const by30 = cumulative.find((c) => c.day === 30)
    if (by7) insights.push(`By day 7: ${by7.pct.toFixed(0)}% have ordered again`)
    if (by14) insights.push(`By day 14: ${by14.pct.toFixed(0)}% have ordered again`)
    if (by30) insights.push(`By day 30: ${by30.pct.toFixed(0)}% have ordered again`)
    if (silent60.length > 0) {
      const remainingPct = (silent60.length / allFirstOrders.length) * 100
      insights.push(
        `After 60d: remaining ${remainingPct.toFixed(0)}% — ${neverReturnAfter60Pct.toFixed(0)}% of these will never return`
      )
    }
    insights.push(
      `If a customer hasn't ordered in 15 days: ${probNeverAt15Days.toFixed(0)}% probability they never will`
    )
    insights.push(
      `If a customer hasn't ordered in 30 days: ${probNeverAt30Days.toFixed(0)}% probability they never will`
    )
    if (reengagement && reengagement.pct > 0) {
      insights.push(`Optimal intervention window: ${optimalInterventionWindow} (${reengagement.pct.toFixed(0)}% reorder in days 8–14)`)
    } else {
      insights.push(`Optimal intervention window: ${optimalInterventionWindow}`)
    }
  }

  return {
    buckets,
    cumulative,
    totalWithSecond,
    neverReturnAfter60Pct,
    probNeverAt15Days,
    probNeverAt30Days,
    optimalInterventionWindow,
    insights,
  }
}

export function customersInTimeBucket(
  customers: CustomerSummary[],
  minDays: number,
  maxDays: number | null
): CustomerSummary[] {
  return customers.filter((c) => {
    if (c.daysToSecondOrder == null || c.daysToSecondOrder <= 0) return false
    const d = c.daysToSecondOrder
    if (maxDays == null) return d >= minDays
    return d >= minDays && d <= maxDays
  })
}
