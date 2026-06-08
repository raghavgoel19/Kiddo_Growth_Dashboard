import { useMemo, useState } from 'react'
import type { PowerUser } from '../api/types'
import { formatINR, formatMonthYear, displayPhone } from '../utils/formatters'

interface PowerUsersTableProps {
  users: PowerUser[]
  excludeInternal: boolean
  onExcludeInternalChange: (value: boolean) => void
}

type SortKey = 'totalSpent' | 'ordersCount' | 'avgOrderValue' | 'customerSince'

export function PowerUsersTable({
  users,
  excludeInternal,
  onExcludeInternalChange,
}: PowerUsersTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalSpent')
  const [sortAsc, setSortAsc] = useState(false)

  const filtered = useMemo(() => {
    let list = [...users]
    if (search) {
      const q = search.replace(/\D/g, '')
      list = list.filter((u) => u.phone.replace(/\D/g, '').includes(q))
    }
    list.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })
    return list.slice(0, 50)
  }, [users, search, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-kiddo-green"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <input
          type="search"
          placeholder="Search phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-kiddo-border px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={excludeInternal}
            onChange={(e) => onExcludeInternalChange(e.target.checked)}
            className="rounded border-slate-300"
          />
          Hide @kiddo.app
        </label>
      </div>
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <SortHeader label="Orders" field="ordersCount" />
              <SortHeader label="Total Spent" field="totalSpent" />
              <SortHeader label="Avg Order Value" field="avgOrderValue" />
              <SortHeader label="Customer Since" field="customerSince" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                <td className="px-4 py-3 text-sm font-medium">{displayPhone(user.phone)}</td>
                <td className="px-4 py-3 text-sm">{user.ordersCount}</td>
                <td className="px-4 py-3 text-sm">{formatINR(user.totalSpent)}</td>
                <td className="px-4 py-3 text-sm">{formatINR(user.avgOrderValue)}</td>
                <td className="px-4 py-3 text-sm">{formatMonthYear(user.customerSince)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                    {user.tierEmoji} {user.tier}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No power users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
