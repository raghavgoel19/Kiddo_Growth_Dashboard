/** Re-exports useMasterData with legacy aliases for older pages. */
import type { GlobalFilters } from '../context/DashboardContext'
import { useMasterData, type UseMasterDataReturn } from './useMasterData'

const LEGACY_TODAY_FILTERS: GlobalFilters = {
  dateMode: 'preset',
  dateRange: 'today',
  customFrom: null,
  customTo: null,
  compareCustomFrom: null,
  compareCustomTo: null,
  orderStatuses: ['all'],
  compareEnabled: false,
  compareMode: null,
  hideTestUsers: false,
}

export { useMasterData, type UseMasterDataReturn, type SyncStatus } from './useMasterData'
export type { SyncStatus as SyncStatusType } from '../sync/syncEngine'

export function useAppData(): UseMasterDataReturn & {
  softRefresh: () => Promise<void>
  syncOrders: () => Promise<void>
} {
  const data = useMasterData()
  return {
    ...data,
    softRefresh: () => data.refreshPage('today', LEGACY_TODAY_FILTERS),
    syncOrders: () => data.refreshPage('summary', LEGACY_TODAY_FILTERS),
  }
}

export type UseAppDataReturn = ReturnType<typeof useAppData>
