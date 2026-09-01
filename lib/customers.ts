import type { Paginated } from "@/lib/tickets"
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validation/customer"
import { request } from "@/lib/api/client"

export { ApiError } from "@/lib/api/client"
export type { FieldErrors } from "@/lib/api/client"

export type CustomerListItem = {
  id: string
  name: string
  email: string
  phone: string
  company: string | null
}

/**
 * `createdAt` / `updatedAt` are `Date` in Prisma but arrive as ISO **strings**
 * — `Response.json` serialises them. Do not type them as `Date`.
 */
export type Customer = CustomerListItem & {
  notes: string
  createdAt: string
  updatedAt: string
}

export const customerKeys = {
  all: ["customers"] as const,
  list: (page = 1) => [...customerKeys.all, "list", page] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
}

export async function fetchCustomers(
  page = 1,
  pageSize?: number,
): Promise<Paginated<CustomerListItem>> {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  if (pageSize) params.set("pageSize", String(pageSize))
  const query = params.toString()

  const { customers, total, page: returnedPage, pageSize: returnedPageSize } = await request<{
    customers: CustomerListItem[]
    total: number
    page: number
    pageSize: number
  }>(`/api/customers${query ? `?${query}` : ""}`)
  return { items: customers, total, page: returnedPage, pageSize: returnedPageSize }
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>(`/api/customers/${id}`)
  return customer
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return customer
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const { customer } = await request<{ customer: Customer }>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return customer
}
