import { differenceInCalendarDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { avg, getOrderL1Categories, type CustomerSummary } from './customerSummary'
import { parseMoney, formatINR } from './formatters'
import { IST } from './dates'

export type ChurnSeverity = 'high' | 'medium' | 'low'

export interface ChurnSignal {
  type: string
  label: string
  severity: ChurnSeverity
}

export interface ChurnRiskResult {
  score: number
  signals: ChurnSignal[]
}

export interface ChurnRiskCustomer {
  customer: CustomerSummary
  score: number
  signals: ChurnSignal[]
  gmvAtRisk: number
}

export function computeChurnRiskScore(
  customer: CustomerSummary,
  productTagsMap: ProductTagsMap
): ChurnRiskResult {
  if (customer.totalOrders < 2) return { score: 0, signals: [] }

  const customerOrders = [...customer.orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const signals: ChurnSignal[] = []
  let score = 0

  const gaps: number[] = []
  for (let i = 1; i < customerOrders.length; i++) {
    gaps.push(
      differenceInCalendarDays(
        toZonedTime(new Date(customerOrders[i].created_at), IST),
        toZonedTime(new Date(customerOrders[i - 1].created_at), IST)
      )
    )
  }
  const avgGap = avg(gaps)
  const daysSinceLast = customer.daysSinceLastOrder

  if (avgGap > 0) {
    const gapRatio = daysSinceLast / avgGap
    if (gapRatio >= 3) {
      score += 45
      signals.push({
        type: 'gap_severe',
        label: `${daysSinceLast}d since last order (${gapRatio.toFixed(1)}× their usual ${avgGap.toFixed(0)}d gap)`,
        severity: 'high',
      })
    } else if (gapRatio >= 2) {
      score += 30
      signals.push({
        type: 'gap_warning',
        label: `${daysSinceLast}d since last order (${gapRatio.toFixed(1)}× usual)`,
        severity: 'medium',
      })
    } else if (gapRatio >= 1.5) {
      score += 15
      signals.push({
        type: 'gap_watch',
        label: `Slightly overdue (${gapRatio.toFixed(1)}× usual gap)`,
        severity: 'low',
      })
    }
  }

  const recentOrders = customerOrders.slice(-3)
  const earlyOrders = customerOrders.slice(0, Math.max(1, customerOrders.length - 3))
  const recentAOV = avg(recentOrders.map((o) => parseMoney(o.total_price)))
  const earlyAOV = avg(earlyOrders.map((o) => parseMoney(o.total_price)))
  const aovDecline = earlyAOV > 0 ? (earlyAOV - recentAOV) / earlyAOV : 0

  if (aovDecline > 0.4) {
    score += 25
    signals.push({
      type: 'aov_decline',
      label: `AOV dropped ${(aovDecline * 100).toFixed(0)}% recently (${formatINR(earlyAOV)} → ${formatINR(recentAOV)})`,
      severity: 'high',
    })
  } else if (aovDecline > 0.25) {
    score += 15
    signals.push({
      type: 'aov_decline_mild',
      label: `AOV declining (${formatINR(earlyAOV)} → ${formatINR(recentAOV)})`,
      severity: 'medium',
    })
  }

  const allTimeCats = new Set<string>()
  for (const o of customerOrders) {
    for (const cat of getOrderL1Categories(o, productTagsMap)) allTimeCats.add(cat)
  }
  const recentCats = new Set<string>()
  for (const o of recentOrders) {
    for (const cat of getOrderL1Categories(o, productTagsMap)) recentCats.add(cat)
  }
  if (allTimeCats.size > 1 && recentCats.size === 1) {
    score += 20
    signals.push({
      type: 'category_narrow',
      label: `Buying fewer categories recently (was ${allTimeCats.size}, now ${recentCats.size})`,
      severity: 'medium',
    })
  }

  const recentChannels = recentOrders.map((o) => getOrderChannel(o))
  const earlyChannels = earlyOrders.map((o) => getOrderChannel(o))
  const wasAppUser = earlyChannels.filter((c) => c === 'app').length > earlyChannels.length * 0.7
  const nowWebUser = recentChannels.filter((c) => c === 'website').length > recentChannels.length * 0.7
  if (wasAppUser && nowWebUser) {
    score += 15
    signals.push({
      type: 'channel_switch',
      label: 'Switched from App to Website',
      severity: 'low',
    })
  }

  if (customer.daysSinceLastOrder >= 20 && customer.totalOrders <= 3) {
    score += 20
    signals.push({
      type: 'early_churn_risk',
      label: 'Low-order customer inactive 20+ days',
      severity: 'high',
    })
  }

  return { score: Math.min(score, 100), signals }
}

export function computeChurnRiskFeed(
  customers: CustomerSummary[],
  productTagsMap: ProductTagsMap,
  minScore = 40
): ChurnRiskCustomer[] {
  return customers
    .filter((c) => c.totalOrders >= 2)
    .map((customer) => {
      const { score, signals } = computeChurnRiskScore(customer, productTagsMap)
      const gmvAtRisk = customer.aov * Math.max(1, customer.totalOrders * 0.5)
      return { customer, score, signals, gmvAtRisk }
    })
    .filter((r) => r.score >= minScore && r.signals.length > 0)
    .sort((a, b) => b.score - a.score)
}

export function churnScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-[#DC2626] text-white'
  if (score >= 60) return 'bg-[#EA580C] text-white'
  if (score >= 40) return 'bg-[#CA8A04] text-white'
  return 'bg-slate-200 text-slate-700'
}

export function churnScoreLabel(score: number): string {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

export type ChurnRiskFilter = 'all' | 'critical' | 'high' | 'medium'

export function filterByRiskLevel(rows: ChurnRiskCustomer[], filter: ChurnRiskFilter): ChurnRiskCustomer[] {
  switch (filter) {
    case 'critical':
      return rows.filter((r) => r.score >= 80)
    case 'high':
      return rows.filter((r) => r.score >= 60)
    case 'medium':
      return rows.filter((r) => r.score >= 40)
    default:
      return rows
  }
}

export function estimateGmvAtRisk(rows: ChurnRiskCustomer[]): number {
  return rows.reduce((s, r) => s + r.gmvAtRisk, 0)
}
