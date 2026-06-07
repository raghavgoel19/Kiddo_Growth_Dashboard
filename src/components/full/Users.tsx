import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Customer, Order, ProductTagsMap } from '../../api/types'
import { computeCustomerCohort, computeKPIs, customersToPowerUsers } from '../../utils/aggregators'
import { formatINR, formatMonthLabel, maskPhone } from '../../utils/formatters'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { InfoTooltipByKey } from '../shared/InfoTooltip'
import { EmptyState } from '../shared/EmptyState'

interface TabProps {
  orders: Order[]
  customers: Customer[]
  customerCount: number
  productTagsMap: ProductTagsMap
}

export function UsersTab({ orders, customers, customerCount }: TabProps) {
  const [search, setSearch] = useState('')

  const filteredOrders = orders

  const kpis = useMemo(
    () => computeKPIs(filteredOrders, customers, customerCount),
    [filteredOrders, customers, customerCount]
  )

  const cohort = useMemo(() => computeCustomerCohort(customers), [customers])

  const newCustomersDaily = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of customers) {
      const key = c.created_at.slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({ date, count }))
  }, [customers])

  const oneAndDoneRate =
    customers.length > 0
      ? (customers.filter((c) => c.orders_count === 1).length / customers.length) * 100
      : 0

  const powerUsers = useMemo(() => {
    const users = customersToPowerUsers(customers)
    const q = search.replace(/\D/g, '')
    const filtered = q
      ? users.filter((u) => u.phone.replace(/\D/g, '').includes(q))
      : users
    return filtered.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20)
  }, [customers, search])

  if (orders.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
          <p className="text-xs uppercase text-slate-400">Total customers</p>
          <p className="mt-1 text-xl font-semibold">{kpis.totalCustomers.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
          <p className="text-xs uppercase text-slate-400">Repeat rate</p>
          <p className="mt-1 text-xl font-semibold">{kpis.repeatCustomerRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
          <p className="text-xs uppercase text-slate-400">One-and-done rate</p>
          <p className="mt-1 text-xl font-semibold">{oneAndDoneRate.toFixed(1)}%</p>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white px-4 py-3">
          <p className="text-xs uppercase text-slate-400">Power users</p>
          <p className="mt-1 text-xl font-semibold">{powerUsers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">New customers per day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={newCustomersDaily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#00A86B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Cohort size (monthly)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cohort.map((c) => ({ ...c, label: formatMonthLabel(c.month) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="newCustomers" fill="#00A86B" name="New" stackId="a" />
              <Bar dataKey="returningCustomers" fill="#0F172A" name="Returning" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="inline-flex items-center gap-1 text-sm font-semibold">
            Power users
            <InfoTooltipByKey metricKey="powerUsers" />
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-kiddo-border px-3 py-1.5 text-sm"
            />
            <ExportButton
              onExport={() =>
                downloadCsv(
                  exportFilename('power_users'),
                  ['Rank', 'Phone', 'Orders', 'Spent', 'AOV', 'Tier'],
                  powerUsers.map((u, i) => [
                    i + 1,
                    u.phone,
                    u.ordersCount,
                    u.totalSpent,
                    u.avgOrderValue,
                    u.tier,
                  ])
                )
              }
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3">#</th>
                <th className="pb-2 pr-3">Phone</th>
                <th className="pb-2 pr-3 text-right">Orders</th>
                <th className="pb-2 pr-3 text-right">Spent</th>
                <th className="pb-2 pr-3 text-right">AOV</th>
                <th className="pb-2">Tier</th>
              </tr>
            </thead>
            <tbody>
              {powerUsers.map((u, i) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-3">{maskPhone(u.phone)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{u.ordersCount}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatINR(u.totalSpent)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatINR(u.avgOrderValue)}</td>
                  <td className="py-2">{u.tierEmoji} {u.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
