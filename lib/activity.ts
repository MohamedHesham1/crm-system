import type { Prisma } from "@prisma/client"

import type { AuditAction, NotificationType } from "@/lib/validation/notification"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

export type AuditEntry = {
  entityType: "Ticket"
  entityId: string
  action: AuditAction
  actorId: string
  detail: string
}

export type NotificationInput = {
  userId: string
  type: NotificationType
  message: string
  relatedTicketId: string | null
}

/**
 * Writes audit rows. `tx` is **required, not optional**: every caller runs
 * inside the same interactive transaction as the mutation it records, so a
 * rolled-back ticket update can never leave a row claiming it happened. A
 * fire-and-forget variant is the one thing this module must not grow.
 *
 * Sequential `create` rather than `createMany`: at most three rows per call,
 * and `createMany`'s `skipDuplicates` is unsupported on SQLite anyway.
 */
export async function logActivity(
  tx: Prisma.TransactionClient,
  entries: AuditEntry[],
): Promise<void> {
  for (const entry of entries) {
    await tx.auditLog.create({ data: entry })
  }
}

/**
 * Writes notification rows, **dropping every entry addressed to `actorId`**.
 * That single filter is what implements "notify the assignee, not the comment
 * author" and what stops an agent being told about their own claim. Callers
 * therefore never need to check "is this me?" themselves.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  actorId: string,
  inputs: NotificationInput[],
): Promise<void> {
  for (const input of inputs) {
    if (input.userId === actorId) continue
    await tx.notification.create({ data: input })
  }
}

type TicketBefore = {
  status: TicketStatus
  priority: TicketPriority
  assignedAgentId: string | null
}

type TicketPatch = {
  status?: TicketStatus
  priority?: TicketPriority
  assignedAgentId?: string | null
}

/**
 * **Pure.** No Prisma, no `Request`. Decides which audit entries a PATCH earns,
 * comparing against the values already stored — a PATCH that sets `status` to
 * the value it already has produces **no** row.
 *
 * `agentNames` carries display names the caller already loaded; ids are the
 * fallback so a missing name degrades to something traceable rather than to
 * "null".
 */
export function describeTicketChanges(
  before: TicketBefore,
  patch: TicketPatch,
  actor: { id: string; name: string },
  agentNames: { previous: string | null; next: string | null },
): { action: AuditAction; detail: string }[] {
  const changes: { action: AuditAction; detail: string }[] = []

  if (patch.status !== undefined && patch.status !== before.status) {
    changes.push({
      action: "STATUS_CHANGED",
      detail: `Status changed from ${before.status} to ${patch.status} by ${actor.name}.`,
    })
  }

  if (patch.priority !== undefined && patch.priority !== before.priority) {
    changes.push({
      action: "PRIORITY_CHANGED",
      detail: `Priority changed from ${before.priority} to ${patch.priority} by ${actor.name}.`,
    })
  }

  // `assignedAgentId: null` is a real value (a release), so the key's presence
  // is tested with `!== undefined`, never with truthiness — the same trap
  // `app/api/tickets/[id]/route.ts:75` avoids with `in`.
  if (patch.assignedAgentId !== undefined && patch.assignedAgentId !== before.assignedAgentId) {
    const next = patch.assignedAgentId
    const nextName = agentNames.next ?? next
    const previousName = agentNames.previous ?? before.assignedAgentId

    if (next === null) {
      changes.push({
        action: "RELEASED",
        detail: `Released to the queue from ${previousName} by ${actor.name}.`,
      })
    } else if (before.assignedAgentId === null) {
      changes.push(
        next === actor.id
          ? { action: "CLAIMED", detail: `Claimed by ${actor.name}.` }
          : { action: "ASSIGNED", detail: `Assigned to ${nextName} by ${actor.name}.` },
      )
    } else {
      changes.push({
        action: "REASSIGNED",
        detail: `Reassigned from ${previousName} to ${nextName} by ${actor.name}.`,
      })
    }
  }

  return changes
}

/**
 * **Pure.** The notification side of an assignment change: the agent who gained
 * the ticket and the agent who lost it. Self-addressed entries are left in —
 * `notify()` drops them, so this function stays independent of who acted.
 */
export function assignmentNotifications(
  ticket: { id: string; subject: string },
  before: string | null,
  next: string | null,
  actorName: string,
): NotificationInput[] {
  if (before === next) return []

  const inputs: NotificationInput[] = []

  if (next !== null) {
    inputs.push({
      userId: next,
      type: "TICKET_ASSIGNED",
      message: `${actorName} assigned "${ticket.subject}" to you.`,
      relatedTicketId: ticket.id,
    })
  }

  if (before !== null) {
    inputs.push({
      userId: before,
      type: "TICKET_UNASSIGNED",
      message: `${actorName} moved "${ticket.subject}" away from you.`,
      relatedTicketId: ticket.id,
    })
  }

  return inputs
}
