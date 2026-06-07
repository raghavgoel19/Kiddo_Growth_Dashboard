import type { Customer, Order } from '../api/types'

const TEST_NAME_PATTERN = /test|dummy|qa/i
const TEST_EMAIL_DOMAIN = '@allforkiddo.com'

export function isTestCustomer(customer: Customer | null | undefined): boolean {
  if (!customer) return false
  const name = `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
  if (TEST_NAME_PATTERN.test(name)) return true
  const email = customer.email?.toLowerCase() ?? ''
  return email.includes(TEST_EMAIL_DOMAIN)
}

export function isTestOrder(order: Order): boolean {
  return isTestCustomer(order.customer)
}

export function filterTestOrders(orders: Order[], hideTestUsers: boolean): Order[] {
  if (!hideTestUsers) return orders
  return orders.filter((o) => !isTestOrder(o))
}

export function filterTestCustomers(customers: Customer[], hideTestUsers: boolean): Customer[] {
  if (!hideTestUsers) return customers
  return customers.filter((c) => !isTestCustomer(c))
}
