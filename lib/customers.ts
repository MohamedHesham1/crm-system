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
  list: () => [...customerKeys.all, "list"] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
}

export async function fetchCustomers(): Promise<CustomerListItem[]> {
  const { customers } = await request<{ customers: CustomerListItem[] }>("/api/customers")
  return customers
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
