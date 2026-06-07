export interface LineItemProperty {
  name: string
  value?: string | null
}

export interface LineItem {
  product_id?: string | number
  product_title?: string
  title?: string
  quantity: number
  price: string
  properties?: LineItemProperty[]
}

export interface ShippingAddress {
  address1?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  zip?: string | null
  city?: string | null
  province?: string | null
  country?: string | null
}

export interface Customer {
  id: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  orders_count: number
  total_spent: string
  created_at: string
  tags?: string
}

export interface Order {
  id: string
  name?: string
  order_number?: number
  created_at: string
  total_price: string
  subtotal_price?: string
  line_items: LineItem[]
  customer: Customer | null
  financial_status: string
  fulfillment_status?: string | null
  shipping_address?: ShippingAddress | null
  cancelled_at?: string | null
  discount_codes?: { code?: string; amount?: string }[]
  source_name?: string | null
  source_identifier?: string | null
}

export interface Product {
  id: string | number
  title?: string
  tags?: string | string[]
}

export interface AppRawData {
  orders: Order[]
  customers: Customer[]
  products: Product[]
  customerCount: number
}

export type DateRange = '7d' | '30d' | '90d' | '12m' | 'all'
export type FullDateRange = 'today' | 'yesterday' | DateRange
export type OrderStatus = 'all' | 'paid' | 'pending' | 'refunded' | 'cancelled'

export interface DashboardFilters {
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

export interface KPIs {
  totalOrders: number
  grossRevenue: number
  averageOrderValue: number
  totalCustomers: number
  repeatCustomerRate: number
  avgItemsPerOrder: number
}

export interface TrendPoint {
  month: string
  revenue: number
  orders: number
  aov: number
}

export interface AOVPoint {
  month: string
  aov: number
}

export interface TopProduct {
  productTitle: string
  grossSales: number
  netSales: number
  orders: number
}

export interface CohortPoint {
  month: string
  newCustomers: number
  returningCustomers: number
}

export interface OrderValueBucket {
  label: string
  count: number
  percentage: number
}

export interface ItemsPerOrderBucket {
  label: string
  count: number
  percentage: number
}

export interface StatusBreakdown {
  status: string
  count: number
  percentage: number
}

export interface PowerUser {
  id: string
  phone: string
  email?: string
  ordersCount: number
  totalSpent: number
  avgOrderValue: number
  customerSince: string
  tier: 'Champion' | 'Loyal' | 'Regular'
  tierEmoji: string
}

export interface DashboardData {
  kpis: KPIs
  revenueTrend: TrendPoint[]
  aovTrend: AOVPoint[]
  topProducts: TopProduct[]
  customerCohort: CohortPoint[]
  orderValueDistribution: OrderValueBucket[]
  itemsPerOrderDistribution: ItemsPerOrderBucket[]
  orderStatusBreakdown: StatusBreakdown[]
  powerUsers: PowerUser[]
  recentOrders: Order[]
  distributionOrders: Order[]
  overallAOV: number
}

export interface ShopifyQLRow {
  [key: string]: string | number | null
}

export interface ShopifyQLResult {
  columns?: { name: string; displayName?: string }[]
  rows?: ShopifyQLRow[]
  data?: ShopifyQLRow[]
  results?: ShopifyQLRow[]
}

export interface MCPListResponse<T> {
  customers?: T[]
  orders?: T[]
  edges?: { node: T }[]
  nodes?: T[]
}

export type ProductTagsMap = Record<string, string[]>

export type DistanceBand = '0-5km' | '5-10km' | '10-15km' | '15-20km' | '20km+' | 'unknown'
export type OrderChannel = 'app' | 'website'
