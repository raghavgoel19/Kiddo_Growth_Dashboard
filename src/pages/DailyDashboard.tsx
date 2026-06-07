import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { SectionCard } from '../components/shared/SectionCard'
import { KPISkeleton } from '../components/shared/Skeleton'
import { DailyKPIBar } from '../components/daily/DailyKPIBar'
import { HourlyChart } from '../components/daily/HourlyChart'
import { DailyCategorySplit } from '../components/daily/DailyCategorySplit'
import { DailyChannelSplit } from '../components/daily/DailyChannelSplit'
import { DailyTopProducts } from '../components/daily/DailyTopProducts'
import { DailyGeoBands } from '../components/daily/DailyGeoBands'
import { LiveOrdersFeed } from '../components/daily/LiveOrdersFeed'
import { getTodayOrders, computeDailyMetrics, splitOrdersByDay } from '../utils/dailyMetrics'
import { formatTodayHeader, formatTimeIST } from '../utils/dates'
import { timeAgo } from '../utils/formatters'
import { SyncControls } from '../components/shared/SyncControls'

const REFRESH_MS = 5 * 60 * 1000

export default function DailyDashboard() {
  const {
    orders,
    productTagsMap,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    syncMeta,
    softRefresh,
    syncOrders,
    syncProducts,
    syncAll,
  } = useAppData()
  const [countdown, setCountdown] = useState(REFRESH_MS)

  const todayOrders = useMemo(() => getTodayOrders(orders), [orders])
  const { yesterday } = useMemo(() => splitOrdersByDay(orders), [orders])
  const yesterdayMetrics = useMemo(() => computeDailyMetrics(yesterday), [yesterday])

  const doRefresh = useCallback(async () => {
    await softRefresh()
    setCountdown(REFRESH_MS)
  }, [softRefresh])

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1000) {
          doRefresh()
          return REFRESH_MS
        }
        return c - 1000
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [doRefresh])

  const countdownLabel = `${Math.floor(countdown / 60000)}:${String(Math.floor((countdown % 60000) / 1000)).padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-kiddo-bg">
      <header className="sticky top-0 z-20 border-b border-kiddo-border bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Kiddo · allforkiddo.com
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Daily pulse
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Today, {formatTodayHeader()}
                {lastFetched && (
                  <>
                    {' · '}
                    Last updated {formatTimeIST(lastFetched)} IST
                    {isRefreshing ? ' · syncing…' : ` · Refreshes in ${countdownLabel}`}
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 self-start">
              <Link
                to="/full"
                className="rounded-md border border-kiddo-border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Full analytics
              </Link>
              <SyncControls
                compact
                isRefreshing={isRefreshing}
                syncMeta={syncMeta}
                onSyncOrders={syncOrders}
                onSyncProducts={syncProducts}
                onSyncAll={syncAll}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">{error}</p>
            <button type="button" onClick={doRefresh} className="mt-2 underline">
              Try again
            </button>
          </div>
        )}

        {isLoading && orders.length === 0 ? (
          <KPISkeleton />
        ) : (
          <>
            {todayOrders.length === 0 && (
              <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No orders yet today. Yesterday: {yesterdayMetrics.orders} orders,{' '}
                {timeAgo(lastFetched)} since last sync.
              </div>
            )}

            <ErrorBoundary>
              <DailyKPIBar orders={orders} productTagsMap={productTagsMap} />
            </ErrorBoundary>

            <ErrorBoundary>
              <SectionCard title="Hourly orders" description="Today vs yesterday vs same day last week (IST).">
                <HourlyChart orders={orders} />
              </SectionCard>
            </ErrorBoundary>

            <ErrorBoundary>
              <SectionCard title="Category split" description="Today's orders by L1 category.">
                <DailyCategorySplit orders={todayOrders} productTagsMap={productTagsMap} />
              </SectionCard>
            </ErrorBoundary>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ErrorBoundary>
                <SectionCard title="Channel split" description="App vs website today.">
                  <DailyChannelSplit orders={orders} />
                </SectionCard>
              </ErrorBoundary>
              <ErrorBoundary>
                <SectionCard title="Geo distribution" description="Orders by distance from dark store.">
                  <DailyGeoBands orders={todayOrders} />
                </SectionCard>
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <SectionCard title="Top products today" description="By revenue.">
                <DailyTopProducts orders={todayOrders} productTagsMap={productTagsMap} />
              </SectionCard>
            </ErrorBoundary>

            <ErrorBoundary>
              <SectionCard title="Live orders" description="Last 20 orders today · refreshes every 2 min.">
                <LiveOrdersFeed orders={orders} productTagsMap={productTagsMap} />
              </SectionCard>
            </ErrorBoundary>
          </>
        )}
      </main>
    </div>
  )
}
