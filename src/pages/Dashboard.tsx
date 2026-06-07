import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppData } from '../hooks/useAppData'
import { DashboardProvider, useDashboardContext } from '../context/DashboardContext'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { PageSkeleton } from '../components/shared/Skeleton'
import { SectionCard } from '../components/shared/SectionCard'
import { DailyKPIBar } from '../components/daily/DailyKPIBar'
import { HourlyChart } from '../components/daily/HourlyChart'
import { DailyCategorySplit } from '../components/daily/DailyCategorySplit'
import { DailyChannelSplit } from '../components/daily/DailyChannelSplit'
import { LiveOrdersFeed } from '../components/daily/LiveOrdersFeed'
import { DailyMetricsTable } from '../components/daily/DailyMetricsTable'
import { SummaryTab } from '../components/full/Summary'
import { OrdersTab } from '../components/full/Orders'
import { UsersTab } from '../components/full/Users'
import { ProductsTab } from '../components/full/Products'
import { GeographyTab } from '../components/full/Geography'
import { ChannelTab } from '../components/full/Channel'
import { GrowthTab } from '../components/full/Growth'
import { CohortBuilder } from '../components/cohorts/CohortBuilder'
import { SyncMenu } from '../components/shared/SyncMenu'
import { SyncStatusLabel } from '../components/shared/SyncStatusLabel'
import { GlobalFilterBar } from '../components/shared/GlobalFilterBar'
import { LoadingBar } from '../components/shared/LoadingBar'
import { DrillDownDrawer } from '../components/drilldown/DrillDownDrawer'
import { OrderDetailModal } from '../components/drilldown/OrderDetailModal'
import { CommandPalette } from '../components/shared/CommandPalette'
import { ValidationConsole } from '../components/shared/ValidationConsole'
import {
  getTodayOrders,
  computeDailyMetrics,
  splitOrdersByDay,
  filterOrdersThroughSameTimeOfDay,
  getIntradayComparisonTimeLabel,
} from '../utils/dailyMetrics'
import { formatTodayHeader, formatTimeIST } from '../utils/dates'
import { filterTestOrders } from '../utils/testUserFilter'
import type { SyncStatus } from '../sync/syncEngine'

const REFRESH_MS = 5 * 60 * 1000

const NAV_ITEMS: { id: SectionId; label: string; section?: 'analytics' | 'tools' }[] = [
  { id: 'today', label: 'Today', section: 'analytics' },
  { id: 'summary', label: 'Summary', section: 'analytics' },
  { id: 'orders', label: 'Orders', section: 'analytics' },
  { id: 'users', label: 'Users', section: 'analytics' },
  { id: 'geography', label: 'Geography', section: 'analytics' },
  { id: 'channel', label: 'Channel', section: 'analytics' },
  { id: 'growth', label: 'Growth', section: 'analytics' },
  { id: 'cohorts', label: 'Cohorts', section: 'tools' },
  { id: 'products', label: 'Products', section: 'tools' },
]

type SectionId =
  | 'today'
  | 'summary'
  | 'orders'
  | 'users'
  | 'cohorts'
  | 'products'
  | 'geography'
  | 'channel'
  | 'growth'

function syncStatusTextFromStatus(status: SyncStatus, orderCount: number): string | null {
  if (status.state === 'loading-cache') return 'Loading from cache…'
  if (status.state === 'syncing') return `Syncing ${status.fetched} new orders…`
  if (status.state === 'done') {
    return `${status.ordersInDB.toLocaleString('en-IN')} orders${
      status.newOrdersFetched > 0 ? ` · ${status.newOrdersFetched} new` : ' · Up to date'
    }`
  }
  if (status.state === 'error' && status.cachedOrdersAvailable > 0) {
    return `${status.cachedOrdersAvailable.toLocaleString('en-IN')} cached orders`
  }
  if (orderCount > 0) return `${orderCount.toLocaleString('en-IN')} orders`
  return null
}

export default function Dashboard() {
  const appData = useAppData()
  const { orders, customers, productTagsMap } = appData

  return (
    <DashboardProvider orders={orders} customers={customers} productTagsMap={productTagsMap}>
      <DashboardShell {...appData} />
    </DashboardProvider>
  )
}

function DashboardShell({
  orders,
  products,
  customerCount,
  productTagsMap,
  isLoading,
  isRefreshing,
  error,
  syncWarning,
  syncStatus,
  lastFetched,
  softRefresh,
  syncOrders,
  syncProducts,
  syncAll,
  retrySync,
}: ReturnType<typeof useAppData>) {
  const [activeSection, setActiveSection] = useState<SectionId>('today')
  const [visitedSections, setVisitedSections] = useState<Set<SectionId>>(() => new Set(['today']))
  const [countdown, setCountdown] = useState(REFRESH_MS)
  const [debugOpen, setDebugOpen] = useState(false)
  const {
    filteredOrders,
    filteredCustomers,
    allOrders,
    filters,
    setHideTestUsers,
    setDateRange,
    openOrderDetail,
    closeDrillDown,
    closeOrderDetail,
  } = useDashboardContext()

  useEffect(() => {
    setVisitedSections((prev) => new Set(prev).add(activeSection))
  }, [activeSection])

  const todayBaseOrders = useMemo(
    () => filterTestOrders(allOrders, filters.hideTestUsers),
    [allOrders, filters.hideTestUsers]
  )

  const todayOrders = useMemo(() => getTodayOrders(todayBaseOrders), [todayBaseOrders])
  const { yesterday } = useMemo(() => splitOrdersByDay(todayBaseOrders), [todayBaseOrders])
  const yesterdaySameTime = useMemo(() => filterOrdersThroughSameTimeOfDay(yesterday), [yesterday])
  const yesterdayMetrics = useMemo(
    () => computeDailyMetrics(yesterdaySameTime, productTagsMap, todayBaseOrders),
    [yesterdaySameTime, productTagsMap, todayBaseOrders]
  )
  const comparisonTime = getIntradayComparisonTimeLabel()

  const tabProps = {
    orders: filteredOrders,
    customers: filteredCustomers,
    customerCount,
    productTagsMap,
    products,
    dateRange: filters.dateRange,
    orderStatus: filters.orderStatuses.includes('all') ? ('all' as const) : filters.orderStatuses[0] ?? 'all',
  }

  const doRefresh = useCallback(async () => {
    await softRefresh()
    setCountdown(REFRESH_MS)
  }, [softRefresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (import.meta.env.DEV && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
          e.preventDefault()
          setDebugOpen((v) => !v)
        }
        return
      }
      if (import.meta.env.DEV && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setDebugOpen((v) => !v)
        return
      }
      if (e.key.toLowerCase() === 'r') doRefresh()
      if (e.key.toLowerCase() === 't') setDateRange('today')
      if (e.key === 'Escape') {
        closeDrillDown()
        closeOrderDetail()
        setDebugOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doRefresh, setDateRange, closeDrillDown, closeOrderDetail])

  useEffect(() => {
    if (activeSection !== 'today') return
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
  }, [doRefresh, activeSection])

  const countdownLabel = `${Math.floor(countdown / 60000)}:${String(Math.floor((countdown % 60000) / 1000)).padStart(2, '0')}`
  const totalOrdersLoaded = orders.length
  const pageTitle = NAV_ITEMS.find((s) => s.id === activeSection)?.label ?? 'Dashboard'

  const syncDotColor = isRefreshing
    ? 'bg-[var(--yellow)]'
    : syncWarning
      ? 'bg-[var(--red)]'
      : 'bg-[var(--accent)]'

  const scopeLabel =
    syncWarning?.scope === 'products'
      ? 'Products'
      : syncWarning?.scope === 'all'
        ? 'Full sync'
        : 'Orders'

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)]">
      <LoadingBar active={isRefreshing} />
      <CommandPalette orders={filteredOrders} onSelectOrder={openOrderDetail} onNavigate={(s) => setActiveSection(s as SectionId)} />
      <DrillDownDrawer />
      <OrderDetailModal productTagsMap={productTagsMap} />
      {import.meta.env.DEV && (
        <ValidationConsole
          orders={orders}
          products={products}
          productTagsMap={productTagsMap}
          open={debugOpen}
          onClose={() => setDebugOpen(false)}
        />
      )}

      <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-[var(--bg-sidebar)]">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-sm font-bold text-white">Kiddo</p>
          <p className="text-[11px] text-[var(--sidebar-text)]">allforkiddo.com</p>
          {syncStatusTextFromStatus(syncStatus, orders.length) ? (
            <p className="mt-2 text-[11px] text-[var(--sidebar-text)]">
              {syncStatusTextFromStatus(syncStatus, orders.length)}
            </p>
          ) : totalOrdersLoaded > 0 ? (
            <p className="mt-2 text-[11px] text-[var(--sidebar-text)]">
              {totalOrdersLoaded.toLocaleString('en-IN')} orders
            </p>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {(['analytics', 'tools'] as const).map((section) => (
            <div key={section}>
              <p className="mb-1 mt-3 px-3 text-[10px] font-medium uppercase tracking-wider text-[var(--sidebar-text)] first:mt-0">
                {section === 'analytics' ? 'Analytics' : 'Tools'}
              </p>
              {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`mb-0.5 flex h-10 w-full items-center rounded-md px-3 text-left text-sm transition-colors ${
                    activeSection === item.id
                      ? 'border-l-2 border-[var(--accent)] bg-[var(--sidebar-active-bg)] font-medium text-[var(--sidebar-active)]'
                      : 'border-l-2 border-transparent text-[var(--sidebar-text)] hover:bg-[var(--sidebar-active-bg)] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--sidebar-text)]">
            <input
              type="checkbox"
              checked={filters.hideTestUsers}
              onChange={(e) => setHideTestUsers(e.target.checked)}
              className="rounded"
            />
            Hide test users
          </label>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--sidebar-text)]">
            <span className={`inline-block h-2 w-2 rounded-full ${syncDotColor}`} />
            {isRefreshing ? 'Syncing…' : syncWarning ? 'Sync error' : 'Synced'}
          </div>
        </div>
      </aside>

      <div className="ml-[220px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[52px] items-center gap-4 border-b border-[var(--border)] bg-white px-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            {activeSection === 'today' ? `Today, ${formatTodayHeader()}` : pageTitle}
          </h2>
          <div className="flex-1" />
          <SyncStatusLabel status={syncStatus} onRetry={() => void retrySync()} />
          {activeSection === 'today' && !isRefreshing && (
            <span className="text-xs text-[var(--text-tertiary)]">Refreshes in {countdownLabel}</span>
          )}
          <span className={`inline-block h-2 w-2 rounded-full ${syncDotColor}`} title="Sync status" />
          <button
            type="button"
            onClick={doRefresh}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-app)]"
          >
            Refresh
          </button>
          <SyncMenu
            isRefreshing={isRefreshing}
            lastSyncedAt={lastFetched}
            onSyncOrders={syncOrders}
            onSyncProducts={syncProducts}
            onSyncAll={syncAll}
          />
        </header>

        <GlobalFilterBar />

        {syncWarning && orders.length > 0 && (
          <div className="border-b border-[var(--yellow)] bg-[var(--yellow-light)] px-6 py-2.5 text-sm text-[var(--yellow)]">
            <span>
              Showing cached data{lastFetched ? ` from ${formatTimeIST(lastFetched)} IST` : ''}. {scopeLabel} sync failed —{' '}
              {syncWarning.message}
            </span>
            <button
              type="button"
              onClick={() => void retrySync()}
              className="ml-3 font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {error && orders.length === 0 && (
          <div className="border-b border-[var(--red)] bg-[var(--red-light)] px-6 py-2.5 text-sm text-[var(--red)]">
            <span className="font-medium">{error}</span>
            <button
              type="button"
              onClick={() => void retrySync()}
              className="ml-3 font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <main className="flex-1 space-y-6 p-6">
          {isLoading && orders.length === 0 ? (
            <PageSkeleton />
          ) : (
            <ErrorBoundary>
              {visitedSections.has('today') && activeSection === 'today' && (
                <div className="space-y-6">
                  {todayOrders.length === 0 && totalOrdersLoaded > 0 && (
                    <div className="rounded-[10px] border border-[var(--yellow)] bg-[var(--yellow-light)] px-4 py-3 text-sm text-[var(--yellow)]">
                      No orders yet today. Yesterday by {comparisonTime}: {yesterdayMetrics.orders} orders.
                    </div>
                  )}
                  <DailyMetricsTable orders={todayBaseOrders} productTagsMap={productTagsMap} />
                  <DailyKPIBar orders={todayBaseOrders} productTagsMap={productTagsMap} />
                  <SectionCard title="Hourly orders" description={`Cumulative · same-time compare (${comparisonTime} IST)`}>
                    <HourlyChart orders={todayBaseOrders} />
                  </SectionCard>
                  <SectionCard title="Category split" description="Today's orders by L1 category.">
                    <DailyCategorySplit orders={todayOrders} productTagsMap={productTagsMap} />
                  </SectionCard>
                  <SectionCard title="Channel split" description="App vs website today.">
                    <DailyChannelSplit orders={todayBaseOrders} />
                  </SectionCard>
                  <SectionCard title="Recent orders" description="Last 20 orders today.">
                    <LiveOrdersFeed orders={todayBaseOrders} productTagsMap={productTagsMap} />
                  </SectionCard>
                </div>
              )}
              {visitedSections.has('summary') && activeSection === 'summary' && <SummaryTab {...tabProps} />}
              {visitedSections.has('orders') && activeSection === 'orders' && <OrdersTab {...tabProps} />}
              {visitedSections.has('users') && activeSection === 'users' && <UsersTab {...tabProps} />}
              {visitedSections.has('cohorts') && activeSection === 'cohorts' && <CohortBuilder />}
              {visitedSections.has('products') && activeSection === 'products' && <ProductsTab {...tabProps} />}
              {visitedSections.has('geography') && activeSection === 'geography' && <GeographyTab {...tabProps} />}
              {visitedSections.has('channel') && activeSection === 'channel' && <ChannelTab {...tabProps} />}
              {visitedSections.has('growth') && activeSection === 'growth' && <GrowthTab {...tabProps} />}
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  )
}
