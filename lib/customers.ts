import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validation/customer"

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

export type FieldErrors = Record<string, string[] | undefined>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export const customerKeys = {
  all: ["customers"] as const,
  list: () => [...customerKeys.all, "list"] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: string } | null)?.error ?? "Request failed.",
      response.status,
      (payload as { fieldErrors?: FieldErrors } | null)?.fieldErrors ?? {},
    )
  }

  return payload as T
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
