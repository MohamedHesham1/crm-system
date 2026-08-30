import { prisma } from "@/lib/prisma"

/**
 * Delete order is dictated by the FK rules in `prisma/schema.prisma`:
 * `AuditLog.actor` is `Restrict` (line 168), so audit rows must go before
 * users; `Comment.author` is `Restrict` (line 141); `Ticket.customer` is
 * `Restrict` (line 72). Everything else cascades, but deleting explicitly
 * keeps the order readable and independent of cascade behaviour.
 */
export async function resetDb(): Promise<void> {
  await prisma.feedback.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
}
