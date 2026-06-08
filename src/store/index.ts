import { create } from 'zustand'
import type { Customer, Order, ProductTagsMap } from '../api/types'
import type { GlobalFilters } from '../context/DashboardContext'
import type { CustomerSummary } from '../utils/customerSummary'
import { debounce } from '../utils/debounce'

const STORAGE_KEY = 'kiddo-hide-test-users'

export const defaultFilters: GlobalFilters = {
  dateMode: 'preset',
  dateRange: '30d',
  customFrom: null,
  customTo: null,
  compareCustomFrom: null,
  compareCustomTo: null,
  orderStatuses: ['all'],
  compareEnabled: false,
  compareMode: null,
  hideTestUsers: typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true',
}

interface DashboardStore {
  rawOrders: Order[]
  customers: Customer[]
  productTagsMap: ProductTagsMap
  filters: GlobalFilters
  filteredOrders: Order[]
  filteredCustomers: Customer[]
  customerSummaries: CustomerSummary[]
  isFiltering: boolean
  setRawOrders: (orders: Order[]) => void
  setCustomers: (customers: Customer[]) => void
  setProductTagsMap: (map: ProductTagsMap) => void
  setFiltersImmediate: (filters: GlobalFilters) => void
  setFilteredOrders: (orders: Order[]) => void
  setFilteredCustomers: (customers: Customer[]) => void
  setCustomerSummaries: (summaries: CustomerSummary[]) => void
  setIsFiltering: (v: boolean) => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  rawOrders: [],
  customers: [],
  productTagsMap: {},
  filters: defaultFilters,
  filteredOrders: [],
  filteredCustomers: [],
  customerSummaries: [],
  isFiltering: false,
  setRawOrders: (orders) => set({ rawOrders: orders }),
  setCustomers: (customers) => set({ customers }),
  setProductTagsMap: (map) => set({ productTagsMap: map }),
  setFiltersImmediate: (filters) => set({ filters }),
  setFilteredOrders: (orders) => set({ filteredOrders: orders, isFiltering: false }),
  setFilteredCustomers: (customers) => set({ filteredCustomers: customers }),
  setCustomerSummaries: (summaries) => set({ customerSummaries: summaries }),
  setIsFiltering: (v) => set({ isFiltering: v }),
}))

export const setFiltersDebounced = debounce((filters: GlobalFilters) => {
  useDashboardStore.getState().setFiltersImmediate(filters)
}, 150)
