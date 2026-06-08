import { differenceInCalendarDays, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { CorrelationRow } from './correlationMatrix'
import type { CustomerSummary } from './customerSummary'
import type { FirstOrderDNA } from './firstOrderDNA'
import { formatINR } from './formatters'
import { IST } from './dates'

export type RepeatConfidence = 'high' | 'medium' | 'low'

export interface RepeatProbabilityResult {
  score: number
  prediction: string
  confidence: RepeatConfidence
  predictedWindow: string
}

export interface RepeatProbabilitySummary {
  total: number
  high: number
  medium: number
  low: number
  highPct: number
  mediumPct: number
  lowPct: number
}

export interface ScoredSingleOrderCustomer {
  customer: CustomerSummary
  repeatProbability: RepeatProbabilityResult
}

export function computeRepeatProbability(
  _customer: CustomerSummary,
  dna: FirstOrderDNA,
  _correlationMatrix: CorrelationRow[]
): RepeatProbabilityResult {
  let score = 30

  if (dna.isMixedBasket) score += 20
  else if (dna.isPureEssentials) score += 15
  else if (dna.isNewParentSignal) score += 18
  else if (dna.isPureLifestyle) score -= 10

  if (dna.orderValue >= 2000) score += 15
  else if (dna.orderValue >= 1000) score += 10
  else if (dna.orderValue >= 500) score += 5
  else score -= 5

  if (dna.channel === 'app') score += 12
  else score -= 5

  if (dna.distanceBand === '0-5km') score += 12
  else if (dna.distanceBand === '5-10km') score += 6
  else if (dna.distanceBand === '15-20km') score -= 5
  else if (dna.distanceBand === '20km+') score -= 10

  if (dna.usedDiscount) score -= 8

  if (dna.timeSlot === 'morning') score += 8
  else if (dna.timeSlot === 'night') score -= 5

  score = Math.min(95, Math.max(5, score))

  const confidence: RepeatConfidence =
    dna.l1Categories.length > 0 && dna.distanceBand !== 'unknown' ? 'high' : 'medium'

  return {
    score,
    prediction:
      score >= 60 ? 'Likely to repeat' : score >= 35 ? 'May repeat with nudge' : 'Low repeat likelihood',
    confidence,
    predictedWindow: predictedWindowForScore(score),
  }
}

function predictedWindowForScore(score: number): string {
  if (score >= 60) return 'days 4–8'
  if (score >= 35) return 'days 8–14'
  return 'days 15–30'
}

export function repeatScoreBadgeClass(score: number): string {
  if (score >= 60) return 'bg-emerald-100 text-emerald-800'
  if (score >= 35) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

export function repeatScoreEmoji(score: number): string {
  if (score >= 60) return '🟢'
  if (score >= 35) return '🟡'
  return '🔴'
}

export function formatFirstOrderLine(dna: FirstOrderDNA): string {
  const cats =
    dna.l1Categories.length > 0
      ? dna.l1Categories.map((c) => (c === 'fashion' ? 'fashion' : c)).join(' + ')
      : 'Unknown'
  const dist =
    dna.distanceKm != null ? `${dna.distanceKm.toFixed(1)}km` : dna.distanceBand === 'unknown' ? '—' : dna.distanceBand
  return `First order: ${cats} · ${formatINR(dna.orderValue)} · ${dna.channel === 'app' ? 'App' : 'Website'} · ${dist}`
}

export function scoreSingleOrderCustomers(
  customers: CustomerSummary[],
  correlationMatrix: CorrelationRow[] = []
): ScoredSingleOrderCustomer[] {
  return customers
    .filter((c) => c.totalOrders === 1)
    .map((customer) => ({
      customer,
      repeatProbability: computeRepeatProbability(customer, customer.firstOrderDNA, correlationMatrix),
    }))
    .sort((a, b) => b.repeatProbability.score - a.repeatProbability.score)
}

export function summarizeRepeatProbability(
  scored: ScoredSingleOrderCustomer[],
  daysBack = 30
): RepeatProbabilitySummary {
  const cutoff = subDays(toZonedTime(new Date(), IST), daysBack)
  const recent = scored.filter((r) => {
    const first = toZonedTime(new Date(r.customer.firstOrderDate), IST)
    return first >= cutoff
  })
  const total = recent.length
  const high = recent.filter((r) => r.repeatProbability.score >= 60).length
  const medium = recent.filter(
    (r) => r.repeatProbability.score >= 35 && r.repeatProbability.score < 60
  ).length
  const low = recent.filter((r) => r.repeatProbability.score < 35).length

  return {
    total,
    high,
    medium,
    low,
    highPct: total > 0 ? (high / total) * 100 : 0,
    mediumPct: total > 0 ? (medium / total) * 100 : 0,
    lowPct: total > 0 ? (low / total) * 100 : 0,
  }
}

export function daysSinceFirstOrder(customer: CustomerSummary): number {
  const today = toZonedTime(new Date(), IST)
  const first = toZonedTime(new Date(customer.firstOrderDate), IST)
  return differenceInCalendarDays(today, first)
}
