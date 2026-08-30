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
}

export type AssignSweepResult = {
  swept: number
  assignments: { ticketId: string; agentId: string; agentName: string }[]
  reason?: string
}

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
  const query = params.toString()
  return query ? `?${query}` : ""
}

export async function fetchTickets(filters: TicketFilters = {}): Promise<TicketListItem[]> {
  const { tickets } = await request<{ tickets: TicketListItem[] }>(
    `/api/tickets${buildQuery(filters)}`,
  )
  return tickets
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
