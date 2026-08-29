import { z } from "zod"

/**
 * The single source of truth for the two String-backed enums on `Ticket`.
 * SQLite has no Prisma `enum` (see `prisma/schema.prisma:10–12`), so the
 * constraint lives here and is enforced by every write path.
 */
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]
export type TicketStatus = (typeof TICKET_STATUSES)[number]

const subject = z
  .string()
  .trim()
  .min(1, "Subject is required.")
  .max(200, "Subject must be 200 characters or fewer.")

const description = z
  .string()
  .trim()
  .min(1, "Description is required.")
  .max(10_000, "Description must be 10,000 characters or fewer.")

const category = z
  .string()
  .trim()
  .min(1, "Category is required.")
  .max(60, "Category must be 60 characters or fewer.")

const priority = z.enum(TICKET_PRIORITIES, { message: "Choose LOW, MEDIUM or HIGH." })

/** Agent-side creation. `customerId` is required; the portal schema has none. */
export const createTicketSchema = z.object({
  subject,
  description,
  category,
  priority,
  customerId: z.string().min(1, "Choose a customer."),
  dueAt: z.iso.datetime({ message: "Enter a valid date and time." }).optional(),
  /** Opt-in self-assignment at creation. Absent or false means unassigned. */
  assignToMe: z.boolean().optional(),
})

/**
 * Portal-side creation. **No `customerId` and no `assignToMe`** — the owning
 * customer comes from the session, never from the body, and a customer can
 * never assign an agent.
 */
export const createPortalTicketSchema = z.object({
  subject,
  description,
  category,
  priority,
})

/**
 * PATCH accepts any subset. `assignedAgentId` is `.nullable()` because **`null`
 * is a meaningful value** — it is how a ticket is released back to the queue.
 * `undefined` (key absent) means "leave assignment alone"; the route handler
 * must distinguish the two with `in`, not with a truthiness check.
 */
export const updateTicketSchema = z.object({
  subject: subject.optional(),
  description: description.optional(),
  category: category.optional(),
  priority: priority.optional(),
  status: z.enum(TICKET_STATUSES, { message: "Choose a valid status." }).optional(),
  assignedAgentId: z.string().min(1).nullable().optional(),
  dueAt: z.iso.datetime({ message: "Enter a valid date and time." }).nullable().optional(),
})

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a comment before posting.")
    .max(10_000, "Comment must be 10,000 characters or fewer."),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type CreatePortalTicketInput = z.infer<typeof createPortalTicketSchema>
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
