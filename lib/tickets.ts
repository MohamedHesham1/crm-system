import { request } from "@/lib/api/client"
import type { TicketFeedback } from "@/lib/feedback"
import type { Role } from "@/lib/roles"
import type {
  CreatePortalTicketInput,
  CreateCommentInput,
  CreateTicketInput,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from "@/lib/validation/ticket"

export { ApiError } from "@/lib/api/client"
export type { FieldErrors } from "@/lib/api/client"

/**
 * `dueAt` / `createdAt` are `DateTime` in Prisma but arrive as ISO **strings**
 * — `Response.json` serialises them. Do not type them as `Date`.
 * `slaBreached` is computed by the server on every read; there is no column.
 */
export type TicketListItem = {
  id: string
  subject: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  dueAt: string | null
  createdAt: string
  slaBreached: boolean
  customer: { id: string; name: string }
  assignedAgent: { id: string; name: string } | null
}

export type TicketComment = {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string; role: Role }
}

export type TicketDetail = TicketListItem & {
  description: string
  customer: { id: string; name: string; email: string; company: string | null }
  assignedAgent: { id: string; name: string; email: string } | null
  comments: TicketComment[]
  /** `null` until the owning customer rates the ticket. On the shared detail payload, so agents see it too — it is not a portal-only field. */
  feedback: TicketFeedback | null
}

export type TicketFilters = {
  status?: TicketStatus
  priority?: TicketPriority
  assigned?: "me" | "none"
  /** 1-based. Omitted means page 1. Part of the filter object so it is part of the cache key. */
  page?: number
  /** Omitted means the server default (25). Capped server-side at 100. */
  pageSize?: number
}

export type AssignSweepResult = {
  swept: number
  assignments: { ticketId: string; agentId: string; agentName: string }[]
  reason?: string
}

/** Shared shape for every paginated list endpoint in this app. */
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }

export const ticketKeys = {
  all: ["tickets"] as const,
  list: (filters: TicketFilters = {}) => [...ticketKeys.all, "list", filters] as const,
  detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
  comments: (id: string) => [...ticketKeys.all, "detail", id, "comments"] as const,
}

function buildQuery(filters: TicketFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.priority) params.set("priority", filters.priority)
  if (filters.assigned) params.set("assigned", filters.assigned)
  if (filters.page && filters.page > 1) params.set("page", String(filters.page))
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize))
  const query = params.toString()
  return query ? `?${query}` : ""
}

export async function fetchTickets(filters: TicketFilters = {}): Promise<Paginated<TicketListItem>> {
  const { tickets, total, page, pageSize } = await request<{
    tickets: TicketListItem[]
    total: number
    page: number
    pageSize: number
  }>(`/api/tickets${buildQuery(filters)}`)
  return { items: tickets, total, page, pageSize }
}

export async function fetchTicket(id: string): Promise<TicketDetail> {
  const { ticket } = await request<{ ticket: TicketDetail }>(`/api/tickets/${id}`)
  return ticket
}

export async function fetchComments(id: string): Promise<TicketComment[]> {
  const { comments } = await request<{ comments: TicketComment[] }>(`/api/tickets/${id}/comments`)
  return comments
}

export async function createTicket(input: CreateTicketInput): Promise<TicketDetail> {
  const { ticket } = await request<{ ticket: TicketDetail }>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return ticket
}

export async function createPortalTicket(input: CreatePortalTicketInput): Promise<TicketDetail> {
  const { ticket } = await request<{ ticket: TicketDetail }>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return ticket
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<TicketDetail> {
  const { ticket } = await request<{ ticket: TicketDetail }>(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return ticket
}

export async function postComment(id: string, input: CreateCommentInput): Promise<TicketComment> {
  const { comment } = await request<{ comment: TicketComment }>(`/api/tickets/${id}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return comment
}

export async function reopenTicket(id: string): Promise<TicketDetail> {
  const { ticket } = await request<{ ticket: TicketDetail }>(`/api/tickets/${id}/reopen`, {
    method: "POST",
  })
  return ticket
}

export async function runAssignSweep(): Promise<AssignSweepResult> {
  return request<AssignSweepResult>("/api/tickets/assign-sweep", { method: "POST" })
}
