import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { FullDateRange, OrderStatus } from '../api/types'
import { useAppData } from '../hooks/useAppData'
import { FilterBar } from '../components/shared/FilterBar'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { PageSkeleton } from '../components/shared/Skeleton'
import { SummaryTab } from '../components/full/Summary'
import { OrdersTab } from '../components/full/Orders'
import { UsersTab } from '../components/full/Users'
import { ProductsTab } from '../components/full/Products'
import { GeographyTab } from '../components/full/Geography'
import { ChannelTab } from '../components/full/Channel'
import { GrowthTab } from '../components/full/Growth'
import { timeAgo } from '../utils/formatters'
import { SyncControls } from '../components/shared/SyncControls'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'orders', label: 'Orders' },
  { id: 'users', label: 'Users' },
  { id: 'products', label: 'Products' },
  { id: 'geography', label: 'Geography' },
  { id: 'channel', label: 'Channel' },
  { id: 'growth', label: 'Growth' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function FullDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('summary')
  const [dateRange, setDateRange] = useState<FullDateRange>('30d')
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all')

  const {
    orders,
    customers,
    products,
    productTagsMap,
    customerCount,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    syncMeta,
    syncOrders,
    syncProducts,
    syncAll,
  } = useAppData()

  const tabProps = {
    orders,
    customers,
    customerCount,
    productTagsMap,
    products,
    dateRange,
    orderStatus,
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-[#0F172A] text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-widest text-white/50">
            Kiddo analytics
          </p>
          <h1 className="mt-1 text-lg font-semibold">Full dashboard</h1>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#00A86B] text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            ← Daily pulse
          </Link>
        </div>
      </aside>

      <div className="ml-[220px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-kiddo-border bg-white/90 px-6 py-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              {lastFetched && (
                <p className="text-xs text-slate-400">
                  {isRefreshing ? 'Syncing…' : `Updated ${timeAgo(lastFetched)}`}
                </p>
              )}
            </div>
            <SyncControls
              isRefreshing={isRefreshing}
              syncMeta={syncMeta}
              onSyncOrders={syncOrders}
              onSyncProducts={syncProducts}
              onSyncAll={syncAll}
            />
          </div>
        </header>

        <main className="flex-1 space-y-6 p-6">
          <FilterBar
            dateRange={dateRange}
            orderStatus={orderStatus}
            onDateRangeChange={setDateRange}
            onOrderStatusChange={setOrderStatus}
          />

          {error && (
            <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{error}</p>
              <button type="button" onClick={syncOrders} className="mt-2 underline">
                Retry orders sync
              </button>
            </div>
          )}

          {isLoading && orders.length === 0 ? (
            <PageSkeleton />
          ) : (
            <ErrorBoundary>
              {activeTab === 'summary' && <SummaryTab {...tabProps} />}
              {activeTab === 'orders' && <OrdersTab {...tabProps} />}
              {activeTab === 'users' && <UsersTab {...tabProps} />}
              {activeTab === 'products' && <ProductsTab {...tabProps} />}
              {activeTab === 'geography' && <GeographyTab {...tabProps} />}
              {activeTab === 'channel' && <ChannelTab {...tabProps} />}
              {activeTab === 'growth' && <GrowthTab {...tabProps} />}
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  )
}
