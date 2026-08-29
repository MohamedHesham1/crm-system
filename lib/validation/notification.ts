import { z } from "zod"

/**
 * `AuditLog.action` and `Notification.type` are Strings, not Prisma enums, for
 * the same reason `Ticket.status` is: SQLite has no `enum`
 * (`prisma/schema.prisma:10–12`). These tuples are the only place the allowed
 * values are listed.
 */
export const AUDIT_ACTIONS = [
  "TICKET_CREATED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "CLAIMED",
  "ASSIGNED",
  "RELEASED",
  "REASSIGNED",
  "REOPENED",
  "TICKET_DELETED",
] as const

export const NOTIFICATION_TYPES = [
  "TICKET_ASSIGNED",
  "TICKET_UNASSIGNED",
  "TICKET_COMMENTED",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/**
 * `read` is a boolean, not an implicit `true`, so the same endpoint can mark a
 * notification unread. `PATCH` with `{ "read": true }` twice is a no-op, not an
 * error.
 */
export const markNotificationSchema = z.object({ read: z.boolean() })

export type MarkNotificationInput = z.infer<typeof markNotificationSchema>
