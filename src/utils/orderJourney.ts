import type { Order, ProductTagsMap } from '../api/types'
import { classifyOrder } from './taxonomy'
import type { CustomerSummary } from './customerSummary'

export interface JourneyFlow {
  from: string
  to: string
  count: number
  key: string
}

export interface SankeyChartData {
  nodes: { name: string }[]
  links: { source: number; target: number; value: number; flowKey: string }[]
}

function primaryL1(order: Order, productTagsMap: ProductTagsMap): string {
  const cats = classifyOrder(order, productTagsMap)
  if (cats.length === 0) return 'Unknown'
  if (cats.length > 1) return 'Mixed'
  return cats[0]
}

export function buildOrderJourneyFlows(
  customers: CustomerSummary[],
  productTagsMap: ProductTagsMap
): JourneyFlow[] {
  const flowMap = new Map<string, number>()

  for (const customer of customers) {
    if (customer.totalOrders < 2) continue

    const sorted = [...customer.orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const categories = sorted.slice(0, 3).map((o) => primaryL1(o, productTagsMap))

    for (let i = 0; i < categories.length - 1; i++) {
      const from = categories[i]
      const to = categories[i + 1]
      const key = `${from}→${to}`
      flowMap.set(key, (flowMap.get(key) ?? 0) + 1)
    }
  }

  return Array.from(flowMap.entries())
    .map(([key, count]) => {
      const [from, to] = key.split('→')
      return { from, to, count, key }
    })
    .sort((a, b) => b.count - a.count)
}

export function flowsToSankeyData(flows: JourneyFlow[], topN = 15): SankeyChartData {
  const top = flows.slice(0, topN)
  const nodeNames = new Set<string>()
  for (const f of top) {
    nodeNames.add(f.from)
    nodeNames.add(f.to)
  }

  const nodes = Array.from(nodeNames).map((name) => ({ name }))
  const indexOf = (name: string) => nodes.findIndex((n) => n.name === name)

  const links = top
    .filter((f) => indexOf(f.from) >= 0 && indexOf(f.to) >= 0)
    .map((f) => ({
      source: indexOf(f.from),
      target: indexOf(f.to),
      value: f.count,
      flowKey: f.key,
    }))

  return { nodes, links }
}

export function generateJourneyInsights(
  flows: JourneyFlow[],
  customers: CustomerSummary[],
  productTagsMap: ProductTagsMap
): string[] {
  if (flows.length === 0) {
    return ['Not enough multi-order customers to map category journeys. Try a wider date range.']
  }

  const insights: string[] = []
  const multiOrder = customers.filter((c) => c.totalOrders >= 2).length
  insights.push(`${multiOrder.toLocaleString('en-IN')} customers with 2+ orders mapped across ${flows.length} category flows.`)

  const fashionToEssentials = flows.find((f) => f.from === 'fashion' && f.to === 'Essentials')
  const essentialsToFashion = flows.find((f) => f.from === 'Essentials' && f.to === 'fashion')
  const fashionFirst = customers.filter((c) => {
    if (c.totalOrders < 3) return false
    const sorted = [...c.orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    return primaryL1(sorted[0], productTagsMap) === 'fashion'
  })

  if (fashionToEssentials && multiOrder > 0) {
    const pct = (fashionToEssentials.count / multiOrder) * 100
    insights.push(
      `${pct.toFixed(0)}% of repeat customers follow fashion → Essentials on their next order (${fashionToEssentials.count.toLocaleString('en-IN')} customers).`
    )
  }

  if (essentialsToFashion && multiOrder > 0) {
    const pct = (essentialsToFashion.count / multiOrder) * 100
    insights.push(
      `${pct.toFixed(0)}% of repeat customers add fashion after starting with Essentials (${essentialsToFashion.count.toLocaleString('en-IN')} customers).`
    )
  }

  const top = flows[0]
  if (top) {
    insights.push(
      `Most common journey: ${top.from} → ${top.to} (${top.count.toLocaleString('en-IN')} customers).`
    )
  }

  if (fashionFirst.length > 0 && fashionToEssentials) {
    const pct = (fashionToEssentials.count / fashionFirst.length) * 100
    insights.push(
      `Of customers with 3+ orders who started in fashion, ${pct.toFixed(0)}% switch to Essentials by order 2.`
    )
  }

  return insights.slice(0, 4)
}

export function customersMatchingFlow(
  customers: CustomerSummary[],
  productTagsMap: ProductTagsMap,
  flowKey: string
): CustomerSummary[] {
  const [from, to] = flowKey.split('→')
  return customers.filter((c) => {
    if (c.totalOrders < 2) return false
    const sorted = [...c.orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    for (let i = 0; i < sorted.length - 1; i++) {
      if (primaryL1(sorted[i], productTagsMap) === from && primaryL1(sorted[i + 1], productTagsMap) === to) {
        return true
      }
    }
    return false
  })
}
