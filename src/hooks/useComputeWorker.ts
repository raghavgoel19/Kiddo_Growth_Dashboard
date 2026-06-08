import { useEffect, useState } from 'react'
import { useDashboardStore } from '../store'
import { filterTestCustomers } from '../utils/testUserFilter'

type ResultHandler = (data: unknown) => void

let worker: Worker | null = null
const handlers = new Map<string, Set<ResultHandler>>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/compute.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      const { type } = event.data as { type: string }
      handlers.get(type)?.forEach((handler) => handler(event.data))
    }
  }
  return worker
}

function subscribe(resultType: string, handler: ResultHandler) {
  const set = handlers.get(resultType) ?? new Set()
  set.add(handler)
  handlers.set(resultType, set)
  return () => {
    set.delete(handler)
  }
}

export function postCompute(type: string, payload: unknown) {
  getWorker().postMessage({ type, payload })
}

export function useFilterWorker() {
  const rawOrders = useDashboardStore((s) => s.rawOrders)
  const customers = useDashboardStore((s) => s.customers)
  const filters = useDashboardStore((s) => s.filters)
  const hideTestUsers = useDashboardStore((s) => s.filters.hideTestUsers)
  const setFilteredOrders = useDashboardStore((s) => s.setFilteredOrders)
  const setFilteredCustomers = useDashboardStore((s) => s.setFilteredCustomers)
  const setIsFiltering = useDashboardStore((s) => s.setIsFiltering)

  useEffect(() => {
    setIsFiltering(true)
    const unsubscribe = subscribe('FILTER_RESULT', (data) => {
      const { result } = data as { result: import('../api/types').Order[] }
      setFilteredOrders(result)
      const ids = new Set(result.map((o) => o.customer?.id).filter(Boolean))
      const matched = customers.filter((c) => ids.has(c.id))
      setFilteredCustomers(filterTestCustomers(matched, hideTestUsers))
    })
    postCompute('FILTER', { orders: rawOrders, filters })
    return unsubscribe
  }, [rawOrders, filters, customers, hideTestUsers, setFilteredOrders, setFilteredCustomers, setIsFiltering])
}

export function useWorkerQuery<T>(
  messageType: string,
  resultType: string,
  payload: unknown,
  enabled = true
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const payloadKey = JSON.stringify(payload)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    const unsubscribe = subscribe(resultType, (message) => {
      const typed = message as { result: T }
      setData(typed.result)
      setLoading(false)
    })
    postCompute(messageType, payload)
    return unsubscribe
  }, [messageType, resultType, enabled, payloadKey])

  return { data, loading }
}
