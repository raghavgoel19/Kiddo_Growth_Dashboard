/** Re-exports useMasterData with legacy aliases for older pages. */
import { useMasterData, type UseMasterDataReturn } from './useMasterData'

export { useMasterData, type UseMasterDataReturn, type SyncStatus } from './useMasterData'
export type { SyncStatus as SyncStatusType } from '../sync/syncEngine'

export function useAppData(): UseMasterDataReturn & {
  softRefresh: () => Promise<void>
  syncOrders: () => Promise<void>
  refreshIncremental: () => Promise<import('../api/types').Order[]>
} {
  const data = useMasterData()
  return {
    ...data,
    softRefresh: async () => {
      await data.refreshIncremental()
    },
    syncOrders: async () => {
      await data.refreshIncremental()
    },
    refreshIncremental: data.refreshIncremental,
  }
}

export type UseAppDataReturn = ReturnType<typeof useAppData>
