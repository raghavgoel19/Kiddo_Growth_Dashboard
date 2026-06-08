import { useCallback, useMemo, useState } from 'react'
import type { ProductTagsMap } from '../api/types'
import type { CohortDeepAnalysis } from '../utils/cohortAnalysis'
import {
  DEFAULT_COHORT_FILTERS,
  type CohortFilters,
} from '../utils/cohortAnalysis'
import { useWorkerQuery } from './useComputeWorker'

const SAVED_KEY = 'kiddo-saved-cohorts'

export function useCohortBuilder(orders: import('../api/types').Order[], productTagsMap: ProductTagsMap) {
  const [draftFilters, setDraftFilters] = useState<CohortFilters>(DEFAULT_COHORT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<CohortFilters | null>(null)
  const [savedCohorts, setSavedCohorts] = useState<{ name: string; filters: CohortFilters }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    } catch {
      return []
    }
  })

  const workerPayload = useMemo(
    () =>
      appliedFilters
        ? { orders, filters: appliedFilters, productTagsMap }
        : null,
    [orders, appliedFilters, productTagsMap]
  )

  const { data: analysis, loading } = useWorkerQuery<CohortDeepAnalysis>(
    'COHORT_DEEP',
    'COHORT_DEEP_RESULT',
    workerPayload ?? { orders: [], filters: DEFAULT_COHORT_FILTERS, productTagsMap },
    !!appliedFilters && orders.length > 0
  )

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters })
  }, [draftFilters])

  const applyPreset = useCallback((preset: Partial<CohortFilters>) => {
    const next = { ...DEFAULT_COHORT_FILTERS, ...preset }
    setDraftFilters(next)
    setAppliedFilters(next)
  }, [])

  const saveCohort = useCallback(
    (name: string) => {
      const filters = appliedFilters ?? draftFilters
      const next = [...savedCohorts.filter((s) => s.name !== name), { name, filters }]
      setSavedCohorts(next)
      localStorage.setItem(SAVED_KEY, JSON.stringify(next))
    },
    [appliedFilters, draftFilters, savedCohorts]
  )

  return {
    draftFilters,
    setDraftFilters,
    appliedFilters,
    applyFilters,
    applyPreset,
    saveCohort,
    savedCohorts,
    analysis,
    loading,
  }
}

export type { CohortFilters }
export {
  DEFAULT_COHORT_FILTERS,
  PRESET_COHORTS,
  INACTIVE_PRESETS,
} from '../utils/cohortAnalysis'
