import { applyFilters } from '../utils/applyFilters'
import { computeCohortDeepAnalysis } from '../utils/cohortAnalysis'
import { buildCustomerSummaries } from '../utils/customerSummary'
import {
  computeDailyPowerUsers,
  computeL2RepeatRates,
  computeMonthlyFrequency,
  computeOrderCountCohortComparison,
  computeRepeatFunnel,
  computeWeeklyPowerUsers,
} from '../utils/retentionMetrics'
import { computeRetentionGrid } from '../utils/retention'

type WorkerMessage =
  | { type: 'FILTER'; payload: { orders: import('../api/types').Order[]; filters: import('../context/DashboardContext').GlobalFilters } }
  | { type: 'RETENTION'; payload: { orders: import('../api/types').Order[] } }
  | {
      type: 'COHORT_DEEP'
      payload: {
        orders: import('../api/types').Order[]
        filters: import('../utils/cohortAnalysis').CohortFilters
        productTagsMap: import('../api/types').ProductTagsMap
      }
    }
  | {
      type: 'RETENTION_BUNDLE'
      payload: { orders: import('../api/types').Order[]; productTagsMap: import('../api/types').ProductTagsMap }
    }

self.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  switch (data.type) {
    case 'FILTER':
      self.postMessage({
        type: 'FILTER_RESULT',
        result: applyFilters(data.payload.orders, data.payload.filters),
      })
      break
    case 'RETENTION':
      self.postMessage({
        type: 'RETENTION_RESULT',
        result: computeRetentionGrid(data.payload.orders),
      })
      break
    case 'COHORT_DEEP':
      self.postMessage({
        type: 'COHORT_DEEP_RESULT',
        result: computeCohortDeepAnalysis(
          data.payload.orders,
          data.payload.filters,
          data.payload.productTagsMap
        ),
      })
      break
    case 'RETENTION_BUNDLE': {
      const { orders, productTagsMap } = data.payload
      const summaries = buildCustomerSummaries(orders, productTagsMap)
      self.postMessage({
        type: 'RETENTION_BUNDLE_RESULT',
        result: {
          monthlyFrequency: computeMonthlyFrequency(orders),
          funnel: computeRepeatFunnel(summaries),
          dailyPower: computeDailyPowerUsers(orders, productTagsMap),
          weeklyPower: computeWeeklyPowerUsers(orders, productTagsMap),
          l2Repeat: computeL2RepeatRates(orders, productTagsMap),
          orderCountCohorts: computeOrderCountCohortComparison(summaries),
        },
      })
      break
    }
    default:
      break
  }
}

export {}
