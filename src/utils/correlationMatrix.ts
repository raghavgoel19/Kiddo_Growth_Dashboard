import type { CustomerSummary } from './customerSummary'
import { avg } from './customerSummary'
import type { OrderValueBucket, TimeSlot } from './firstOrderDNA'

export interface CorrelationRow {
  group: string
  attribute: string
  attributeKey: string
  customers: number
  repeatRate: number
  powerUserRate: number
  avgDaysToSecond: number
  avgLtv: number
  customerIds: string[]
}

export interface SegmentHeatmapCell {
  dim1: string
  dim2: string
  repeatRate: number
  customers: number
  customerIds: string[]
}

export interface L2GatewayRow {
  l2: string
  customers: number
  repeatRate: number
  avgLtv: number
  customerIds: string[]
}

function segmentMetrics(customers: CustomerSummary[]) {
  if (customers.length === 0) {
    return { repeatRate: 0, powerUserRate: 0, avgDaysToSecond: 0, avgLtv: 0 }
  }
  const withSecond = customers.filter((c) => c.daysToSecondOrder != null)
  return {
    repeatRate: (customers.filter((c) => c.totalOrders >= 2).length / customers.length) * 100,
    powerUserRate: (customers.filter((c) => c.isPowerUser).length / customers.length) * 100,
    avgDaysToSecond: avg(withSecond.map((c) => c.daysToSecondOrder!)),
    avgLtv: avg(customers.map((c) => c.totalSpent)),
  }
}

function row(
  group: string,
  attribute: string,
  attributeKey: string,
  customers: CustomerSummary[]
): CorrelationRow {
  const m = segmentMetrics(customers)
  return {
    group,
    attribute,
    attributeKey,
    customers: customers.length,
    repeatRate: m.repeatRate,
    powerUserRate: m.powerUserRate,
    avgDaysToSecond: m.avgDaysToSecond,
    avgLtv: m.avgLtv,
    customerIds: customers.map((c) => c.id),
  }
}

const L1_LABELS: Record<string, string> = {
  Essentials: 'Had Essentials',
  fashion: 'Had fashion',
  Toys: 'Had Toys',
  Books: 'Had Books',
  'Gear & Furniture': 'Had Gear & Furniture',
  'School & Stationery': 'Had School & Stationery',
}

const BUCKET_LABELS: Record<OrderValueBucket, string> = {
  under500: 'Under ₹500',
  '500-1k': '₹500–₹1,000',
  '1k-2k': '₹1,000–₹2,000',
  '2k-5k': '₹2,000–₹5,000',
  '5k+': 'Over ₹5,000',
}

const TIME_LABELS: Record<TimeSlot, string> = {
  'early-morning': 'Early morning (5–9 AM)',
  morning: 'Morning (9 AM–12 PM)',
  afternoon: 'Afternoon (12–5 PM)',
  evening: 'Evening (5–9 PM)',
  night: 'Night (9 PM–5 AM)',
}

const DISTANCE_LABELS: Record<string, string> = {
  '0-5km': '0–5 km',
  '5-10km': '5–10 km',
  '10-15km': '10–15 km',
  '15-20km': '15–20 km',
  '20km+': '20+ km',
  unknown: 'Unknown distance',
}

export function computeCorrelationMatrix(customers: CustomerSummary[]): CorrelationRow[] {
  const withDna = customers.filter((c) => c.firstOrderDNA)
  const rows: CorrelationRow[] = []

  for (const [l1, label] of Object.entries(L1_LABELS)) {
    const matched = withDna.filter((c) => c.firstOrderDNA!.l1Categories.includes(l1))
    rows.push(row('BY L1 CATEGORY', label, `l1:${l1}`, matched))
  }
  rows.push(
    row(
      'BY L1 CATEGORY',
      'Mixed basket (2+ L1)',
      'basket:mixed',
      withDna.filter((c) => c.firstOrderDNA!.isMixedBasket)
    )
  )

  for (const bucket of Object.keys(BUCKET_LABELS) as OrderValueBucket[]) {
    rows.push(
      row(
        'BY AOV BUCKET',
        BUCKET_LABELS[bucket],
        `aov:${bucket}`,
        withDna.filter((c) => c.firstOrderDNA!.orderValueBucket === bucket)
      )
    )
  }

  rows.push(
    row('BY CHANNEL', 'App', 'channel:app', withDna.filter((c) => c.firstOrderDNA!.channel === 'app')),
    row('BY CHANNEL', 'Website', 'channel:website', withDna.filter((c) => c.firstOrderDNA!.channel === 'website'))
  )

  for (const slot of Object.keys(TIME_LABELS) as TimeSlot[]) {
    rows.push(
      row(
        'BY TIME OF DAY',
        TIME_LABELS[slot],
        `time:${slot}`,
        withDna.filter((c) => c.firstOrderDNA!.timeSlot === slot)
      )
    )
  }

  for (const band of ['0-5km', '5-10km', '10-15km', '15-20km', '20km+', 'unknown'] as const) {
    rows.push(
      row(
        'BY DISTANCE',
        DISTANCE_LABELS[band],
        `distance:${band}`,
        withDna.filter((c) => c.firstOrderDNA!.distanceBand === band)
      )
    )
  }

  rows.push(
    row(
      'BY DISCOUNT',
      'Used discount',
      'discount:yes',
      withDna.filter((c) => c.firstOrderDNA!.usedDiscount)
    ),
    row(
      'BY DISCOUNT',
      'No discount',
      'discount:no',
      withDna.filter((c) => !c.firstOrderDNA!.usedDiscount)
    ),
    row(
      'BY BASKET TYPE',
      'Pure Essentials',
      'basket:pure-essentials',
      withDna.filter((c) => c.firstOrderDNA!.isPureEssentials)
    ),
    row(
      'BY BASKET TYPE',
      'Pure Lifestyle',
      'basket:pure-lifestyle',
      withDna.filter((c) => c.firstOrderDNA!.isPureLifestyle)
    ),
    row(
      'BY BASKET TYPE',
      'Mixed (Essentials+other)',
      'basket:mixed',
      withDna.filter((c) => c.firstOrderDNA!.isMixedBasket)
    ),
    row(
      'BY NEW PARENT SIGNAL',
      'New parent signal',
      'signal:new-parent',
      withDna.filter((c) => c.firstOrderDNA!.isNewParentSignal)
    ),
    row(
      'BY NEW PARENT SIGNAL',
      'No new parent signal',
      'signal:no-new-parent',
      withDna.filter((c) => !c.firstOrderDNA!.isNewParentSignal)
    )
  )

  return rows.filter((r) => r.customers > 0).sort((a, b) => b.repeatRate - a.repeatRate)
}

export function generateKeyFindings(matrix: CorrelationRow[]): string[] {
  if (matrix.length < 2) return ['Not enough data to generate insights yet. Load a wider date range.']

  const findings: string[] = []
  const sorted = [...matrix].sort((a, b) => b.repeatRate - a.repeatRate)
  const highest = sorted[0]
  const lowest = sorted[sorted.length - 1]

  if (highest && lowest && highest.attributeKey !== lowest.attributeKey) {
    findings.push(
      `🏆 ${highest.attribute} has the highest repeat rate at ${highest.repeatRate.toFixed(0)}% (${highest.customers.toLocaleString('en-IN')} customers).`
    )
    findings.push(
      `⚠️ ${lowest.attribute} has the lowest repeat rate at ${lowest.repeatRate.toFixed(0)}% — worth investigating acquisition quality.`
    )
  }

  const app = matrix.find((r) => r.attributeKey === 'channel:app')
  const web = matrix.find((r) => r.attributeKey === 'channel:website')
  if (app && web) {
    const gap = app.repeatRate - web.repeatRate
    findings.push(
      `${gap >= 0 ? '📱' : '🌐'} App customers repeat ${Math.abs(gap).toFixed(0)}% ${gap >= 0 ? 'more' : 'less'} than website (${app.repeatRate.toFixed(0)}% vs ${web.repeatRate.toFixed(0)}%).`
    )
  }

  const mixed = matrix.find((r) => r.attributeKey === 'basket:mixed')
  const lifestyle = matrix.find((r) => r.attributeKey === 'basket:pure-lifestyle')
  if (mixed && lifestyle && lifestyle.repeatRate > 0) {
    const mult = mixed.repeatRate / lifestyle.repeatRate
    findings.push(
      `🛒 Mixed basket first orders repeat ${mult.toFixed(1)}× more than lifestyle-only (${mixed.repeatRate.toFixed(0)}% vs ${lifestyle.repeatRate.toFixed(0)}%).`
    )
  }

  const discount = matrix.find((r) => r.attributeKey === 'discount:yes')
  const noDiscount = matrix.find((r) => r.attributeKey === 'discount:no')
  if (discount && noDiscount) {
    const gap = noDiscount.repeatRate - discount.repeatRate
    if (gap > 3) {
      findings.push(
        `💸 Discount orders repeat ${gap.toFixed(0)}% less than non-discount — discounts may attract lower-loyalty buyers.`
      )
    }
  }

  const np = matrix.find((r) => r.attributeKey === 'signal:new-parent')
  if (np && np.avgLtv > 0) {
    const overallLtv = avg(matrix.map((r) => r.avgLtv))
    if (overallLtv > 0 && np.avgLtv > overallLtv * 1.1) {
      findings.push(
        `👶 New-parent signal customers avg LTV ${formatINRShort(np.avgLtv)} vs ${formatINRShort(overallLtv)} overall.`
      )
    }
  }

  return findings.slice(0, 5)
}

function formatINRShort(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${Math.round(n)}`
}

export type HeatmapDim = 'channel' | 'l1' | 'aov' | 'time' | 'distance'

const DIM1_OPTIONS: { id: HeatmapDim; label: string }[] = [
  { id: 'channel', label: 'Channel' },
  { id: 'l1', label: 'L1 Category' },
  { id: 'aov', label: 'AOV Bucket' },
  { id: 'time', label: 'Time of Day' },
  { id: 'distance', label: 'Distance' },
]

export { DIM1_OPTIONS }

function dimValue(c: CustomerSummary, dim: HeatmapDim): string {
  const dna = c.firstOrderDNA!
  switch (dim) {
    case 'channel':
      return dna.channel === 'app' ? 'App' : 'Website'
    case 'l1':
      if (dna.isMixedBasket) return 'Mixed'
      return dna.l1Categories[0] ?? 'Unknown'
    case 'aov':
      return BUCKET_LABELS[dna.orderValueBucket]
    case 'time':
      return TIME_LABELS[dna.timeSlot]
    case 'distance':
      return DISTANCE_LABELS[dna.distanceBand] ?? dna.distanceBand
    default:
      return 'Unknown'
  }
}

export function computeSegmentHeatmap(
  customers: CustomerSummary[],
  dim1: HeatmapDim,
  dim2: HeatmapDim
): { rows: string[]; cols: string[]; cells: SegmentHeatmapCell[] } {
  const withDna = customers.filter((c) => c.firstOrderDNA)
  const rowSet = new Set<string>()
  const colSet = new Set<string>()

  for (const c of withDna) {
    rowSet.add(dimValue(c, dim1))
    colSet.add(dimValue(c, dim2))
  }

  const rows = Array.from(rowSet).sort()
  const cols = Array.from(colSet).sort()
  const cells: SegmentHeatmapCell[] = []

  for (const r of rows) {
    for (const col of cols) {
      const matched = withDna.filter((c) => dimValue(c, dim1) === r && dimValue(c, dim2) === col)
      if (matched.length === 0) continue
      const m = segmentMetrics(matched)
      cells.push({
        dim1: r,
        dim2: col,
        repeatRate: m.repeatRate,
        customers: matched.length,
        customerIds: matched.map((c) => c.id),
      })
    }
  }

  return { rows, cols, cells }
}

export function computeL2Gateway(customers: CustomerSummary[]): L2GatewayRow[] {
  const map = new Map<string, CustomerSummary[]>()

  for (const c of customers) {
    const dna = c.firstOrderDNA
    if (!dna) continue
    for (const l2 of dna.l2Categories) {
      const list = map.get(l2) ?? []
      list.push(c)
      map.set(l2, list)
    }
  }

  return Array.from(map.entries())
    .map(([l2, cohort]) => {
      const m = segmentMetrics(cohort)
      return {
        l2,
        customers: cohort.length,
        repeatRate: m.repeatRate,
        avgLtv: m.avgLtv,
        customerIds: cohort.map((c) => c.id),
      }
    })
    .filter((r) => r.customers >= 3)
    .sort((a, b) => b.avgLtv - a.avgLtv)
}

export function repeatRateColor(rate: number): string {
  if (rate >= 60) return 'bg-[#047857] text-white'
  if (rate >= 40) return 'bg-[#86EFAC] text-slate-900'
  if (rate >= 20) return 'bg-[#FDE68A] text-slate-900'
  return 'bg-[#FCA5A5] text-slate-900'
}

export function filterCustomersByKey(customers: CustomerSummary[], key: string): CustomerSummary[] {
  return customers.filter((c) => {
    const dna = c.firstOrderDNA
    if (!dna) return false
    if (key.startsWith('l1:')) return dna.l1Categories.includes(key.slice(3))
    if (key === 'basket:mixed') return dna.isMixedBasket
    if (key === 'basket:pure-essentials') return dna.isPureEssentials
    if (key === 'basket:pure-lifestyle') return dna.isPureLifestyle
    if (key.startsWith('aov:')) return dna.orderValueBucket === key.slice(4)
    if (key === 'channel:app') return dna.channel === 'app'
    if (key === 'channel:website') return dna.channel === 'website'
    if (key.startsWith('time:')) return dna.timeSlot === key.slice(5)
    if (key.startsWith('distance:')) return dna.distanceBand === key.slice(9)
    if (key === 'discount:yes') return dna.usedDiscount
    if (key === 'discount:no') return !dna.usedDiscount
    if (key === 'signal:new-parent') return dna.isNewParentSignal
    if (key === 'signal:no-new-parent') return !dna.isNewParentSignal
    return false
  })
}
