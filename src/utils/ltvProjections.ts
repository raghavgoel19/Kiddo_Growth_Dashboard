import { addDays, differenceInCalendarDays, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { FirstOrderDNA } from './firstOrderDNA'
import { avg, type CustomerSummary } from './customerSummary'
import { parseMoney } from './formatters'
import { IST } from './dates'

export type LtvSegmentKey =
  | 'new_parent'
  | 'mixed_app'
  | 'mixed_web'
  | 'essentials_app'
  | 'essentials_web'
  | 'high_aov'
  | 'lifestyle_app'
  | 'lifestyle_web'

export interface LtvSegmentDef {
  key: LtvSegmentKey
  label: string
  match: (dna: FirstOrderDNA) => boolean
}

export const LTV_SEGMENT_DEFS: LtvSegmentDef[] = [
  { key: 'new_parent', label: 'New parent signal', match: (d) => d.isNewParentSignal },
  {
    key: 'mixed_app',
    label: 'Mixed basket, App',
    match: (d) => d.isMixedBasket && d.channel === 'app',
  },
  {
    key: 'mixed_web',
    label: 'Mixed basket, Website',
    match: (d) => d.isMixedBasket && d.channel === 'website',
  },
  {
    key: 'essentials_app',
    label: 'Pure Essentials, App',
    match: (d) => d.isPureEssentials && d.channel === 'app',
  },
  {
    key: 'essentials_web',
    label: 'Pure Essentials, Web',
    match: (d) => d.isPureEssentials && d.channel === 'website',
  },
  { key: 'high_aov', label: 'High AOV (₹2k+)', match: (d) => d.orderValue >= 2000 },
  {
    key: 'lifestyle_app',
    label: 'Pure lifestyle, App',
    match: (d) => d.isPureLifestyle && d.channel === 'app',
  },
  {
    key: 'lifestyle_web',
    label: 'Pure lifestyle, Web',
    match: (d) => d.isPureLifestyle && d.channel === 'website',
  },
]

export interface LtvProjectionRow {
  key: LtvSegmentKey
  label: string
  newCustomers: number
  expected90dLtv: number
  expectedGmv: number
  historicalSample: number
  customerIds: string[]
}

export interface LtvProjectionResult {
  rows: LtvProjectionRow[]
  totalNewCustomers: number
  totalProjectedGmv: number
  lookbackDays: number
  historicalMinDays: number
}

const MIN_HISTORICAL_SAMPLE = 5

function daysSinceFirstOrder(customer: CustomerSummary): number {
  const today = toZonedTime(new Date(), IST)
  const first = toZonedTime(new Date(customer.firstOrderDate), IST)
  return differenceInCalendarDays(today, first)
}

export function spendInFirst90Days(customer: CustomerSummary): number {
  const first = toZonedTime(new Date(customer.firstOrderDate), IST)
  const end = addDays(first, 90)
  return customer.orders
    .filter((o) => toZonedTime(new Date(o.created_at), IST) <= end)
    .reduce((sum, o) => sum + parseMoney(o.total_price), 0)
}

function ordersInFirst90Days(customer: CustomerSummary): number {
  const first = toZonedTime(new Date(customer.firstOrderDate), IST)
  const end = addDays(first, 90)
  return customer.orders.filter((o) => toZonedTime(new Date(o.created_at), IST) <= end).length
}

/** Mutually exclusive segment for a new customer (priority order). */
export function assignLtvSegment(dna: FirstOrderDNA): LtvSegmentKey | null {
  for (const seg of LTV_SEGMENT_DEFS) {
    if (seg.match(dna)) return seg.key
  }
  return null
}

function historicalBenchmarkLtv(historical: CustomerSummary[]): number {
  if (historical.length === 0) return 0

  const withFullWindow = historical.filter((c) => daysSinceFirstOrder(c) >= 90)
  const cohort = withFullWindow.length >= MIN_HISTORICAL_SAMPLE ? withFullWindow : historical

  if (cohort.length >= MIN_HISTORICAL_SAMPLE) {
    return avg(cohort.map(spendInFirst90Days))
  }

  const repeatRate = cohort.filter((c) => c.totalOrders >= 2).length / cohort.length
  const avgFirstAov = avg(cohort.map((c) => c.firstOrderDNA.orderValue))
  const avgOrders = avg(cohort.map(ordersInFirst90Days))
  return avgFirstAov * Math.max(1, avgOrders) * Math.max(repeatRate, 0.15)
}

export function computeLtvProjections(
  customers: CustomerSummary[],
  lookbackDays = 30,
  historicalMinDays = 90
): LtvProjectionResult {
  const today = toZonedTime(new Date(), IST)
  const newCutoff = subDays(today, lookbackDays)

  const newCustomers = customers.filter((c) => {
    const first = toZonedTime(new Date(c.firstOrderDate), IST)
    return first >= newCutoff
  })

  const historicalPool = customers.filter((c) => daysSinceFirstOrder(c) >= historicalMinDays)

  const assigned = new Map<LtvSegmentKey, CustomerSummary[]>()
  for (const seg of LTV_SEGMENT_DEFS) {
    assigned.set(seg.key, [])
  }

  for (const customer of newCustomers) {
    const key = assignLtvSegment(customer.firstOrderDNA)
    if (key) assigned.get(key)!.push(customer)
  }

  const rows: LtvProjectionRow[] = LTV_SEGMENT_DEFS.map((seg) => {
    const segmentNew = assigned.get(seg.key) ?? []
    const historical = historicalPool.filter((c) => seg.match(c.firstOrderDNA))
    const expected90dLtv = historicalBenchmarkLtv(historical)
    const expectedGmv = expected90dLtv * segmentNew.length

    return {
      key: seg.key,
      label: seg.label,
      newCustomers: segmentNew.length,
      expected90dLtv,
      expectedGmv,
      historicalSample: historical.length,
      customerIds: segmentNew.map((c) => c.id),
    }
  }).filter((r) => r.newCustomers > 0 || r.historicalSample >= MIN_HISTORICAL_SAMPLE)

  const totalProjectedGmv = rows.reduce((s, r) => s + r.expectedGmv, 0)

  return {
    rows,
    totalNewCustomers: newCustomers.length,
    totalProjectedGmv,
    lookbackDays,
    historicalMinDays,
  }
}

export function customersForLtvSegment(
  customers: CustomerSummary[],
  key: LtvSegmentKey,
  lookbackDays = 30
): CustomerSummary[] {
  const today = toZonedTime(new Date(), IST)
  const newCutoff = subDays(today, lookbackDays)
  return customers.filter((c) => {
    const first = toZonedTime(new Date(c.firstOrderDate), IST)
    if (first < newCutoff) return false
    return assignLtvSegment(c.firstOrderDNA) === key
  })
}
