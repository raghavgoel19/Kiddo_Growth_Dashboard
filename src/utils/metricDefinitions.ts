export interface MetricDefinition {
  title: string
  definition: string
  formula: string
  exclusions: string
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  totalOrders: {
    title: 'Total Orders',
    definition: 'All orders placed in the selected period',
    formula: 'Count of orders',
    exclusions: 'Cancelled orders included unless status filter applied',
  },
  gmv: {
    title: 'GMV / Gross Revenue',
    definition: 'Total value of all orders before any deductions',
    formula: 'Sum of order total_price',
    exclusions: 'None',
  },
  aov: {
    title: 'AOV',
    definition: 'How much customers spend per order on average',
    formula: 'GMV ÷ Total Orders',
    exclusions: 'None',
  },
  firstTimeOrders: {
    title: '1st Time Orders',
    definition: 'Orders placed by customers ordering for the very first time',
    formula: "Customer's first-ever order in store history",
    exclusions: 'Guest checkouts without customer ID excluded',
  },
  repeatOrders: {
    title: 'Repeat Orders',
    definition: 'Orders placed by customers who have ordered before',
    formula: 'Orders that are not the customer\'s first order',
    exclusions: 'None',
  },
  repeatRate: {
    title: 'Repeat Rate',
    definition: '% of customers who placed more than one order',
    formula: 'Customers with 2+ orders ÷ total customers × 100',
    exclusions: 'Customers with 0 orders',
  },
  cac: {
    title: 'CAC',
    definition: 'How much you spend on ads to acquire one new customer',
    formula: 'Ad spend ÷ New customers',
    exclusions: 'Requires Meta ad data',
  },
  nonEssentialOrders: {
    title: 'Non-Essential Orders',
    definition: 'Orders containing no essential baby products',
    formula: 'Orders with no Essentials-tagged items',
    exclusions: 'Uncategorized if product tags missing',
  },
  pctNonEssential: {
    title: '% Non-Essential',
    definition: 'Share of orders that are non-essential',
    formula: 'Non-essential orders ÷ total orders × 100',
    exclusions: 'None',
  },
  ltv: {
    title: 'LTV',
    definition: 'Total revenue from a customer over their lifetime',
    formula: 'Sum of all order values for that customer',
    exclusions: 'None',
  },
  avgItemsPerOrder: {
    title: 'Avg items/order',
    definition: 'How many items are in a typical order',
    formula: 'Total items across all orders ÷ total orders',
    exclusions: 'None',
  },
  distanceBand: {
    title: 'Distance band',
    definition: 'How far the delivery address is from our dark store in Sector 104 Noida',
    formula: 'Haversine distance from 28.539868, 77.371612',
    exclusions: 'Orders with no delivery coordinates',
  },
  churnRisk: {
    title: 'Churn risk',
    definition: 'Repeat customers who haven\'t ordered in a while',
    formula: 'Customers with 2+ orders and last order 30+ days ago',
    exclusions: 'None',
  },
  spendIncrease: {
    title: 'Spend Increase',
    definition: 'Change in GMV compared to the previous day',
    formula: '% change in daily GMV vs previous day',
    exclusions: 'None',
  },
  totalOrdersGrowth: {
    title: 'Total Orders Growth Rate',
    definition: 'Day-over-day change in order count',
    formula: '% change vs previous day',
    exclusions: 'None',
  },
  firstTimeGrowth: {
    title: '1st Time Order Growth Rate',
    definition: 'Day-over-day change in first-time orders',
    formula: '% change vs previous day',
    exclusions: 'None',
  },
  repeatGrowth: {
    title: 'Repeat Order Growth Rate',
    definition: 'Day-over-day change in repeat orders',
    formula: '% change vs previous day',
    exclusions: 'None',
  },
  channel: {
    title: 'Channel',
    definition: 'Whether the order came from the Kiddo app or website',
    formula: 'Based on order tags and source',
    exclusions: 'Unknown if channel cannot be determined',
  },
  geoBand: {
    title: 'Geo band',
    definition: 'Delivery distance from dark store',
    formula: 'Haversine distance buckets',
    exclusions: 'Missing coordinates → unknown',
  },
  hourlyOrders: {
    title: 'Hourly orders',
    definition: 'Cumulative order count through each hour of the day',
    formula: 'Running count of orders by hour (IST)',
    exclusions: 'Today uses same-time cutoff',
  },
  categorySplit: {
    title: 'Category split',
    definition: 'Share of GMV by primary L1 category',
    formula: 'GMV per category ÷ total GMV',
    exclusions: 'Uncategorized if tags missing',
  },
  topProducts: {
    title: 'Top products',
    definition: 'Best-selling products by revenue today',
    formula: 'Sum of line item revenue',
    exclusions: 'None',
  },
  liveOrders: {
    title: 'Live orders',
    definition: 'Most recent orders placed today',
    formula: 'Last 20 orders by created_at',
    exclusions: 'None',
  },
  comparePeriod: {
    title: 'Compare period',
    definition: 'Overlay a second date range on charts',
    formula: 'Previous period, same period last year, or custom',
    exclusions: 'Compare window must have data',
  },
  cohortFrequency: {
    title: 'Order frequency',
    definition: 'How many orders each cohort customer has placed',
    formula: 'Histogram of customer orders_count',
    exclusions: 'None',
  },
  cohortAov: {
    title: 'AOV distribution',
    definition: 'Spread of order values in the cohort',
    formula: 'Orders bucketed by total_price',
    exclusions: 'None',
  },
  cohortMonthly: {
    title: 'Monthly trend',
    definition: 'Cohort order volume over the last 12 months',
    formula: 'Orders grouped by IST month',
    exclusions: 'None',
  },
  powerUsers: {
    title: 'Power users',
    definition: 'Customers with the highest order counts and spend',
    formula: 'Sorted by orders_count and total_spent',
    exclusions: 'Test users if hidden',
  },
  pincodeTable: {
    title: 'Pincode performance',
    definition: 'Orders and GMV by delivery pincode',
    formula: 'Grouped by shipping_address.zip',
    exclusions: 'Missing zip excluded',
  },
  l2Products: {
    title: 'L2 products',
    definition: 'Product-level performance in selected period',
    formula: 'Line item aggregation',
    exclusions: 'None',
  },
  momentum: {
    title: 'Growth momentum',
    definition: 'Week-over-week order and GMV trends',
    formula: '% change vs prior week',
    exclusions: 'None',
  },
}
