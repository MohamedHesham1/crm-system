import { prisma } from "@/lib/prisma"
import type { Role } from "@/lib/roles"
import { defaultDueAt } from "@/lib/sla"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

let seq = 0
const unique = () => `${Date.now()}-${seq++}`

/**
 * `passwordHash` is a literal, never a real bcrypt hash: nothing in this suite
 * goes through `authorize()` (`auth.ts:18–36`) — sessions come from
 * `tests/mocks/auth.ts` instead — so hashing would cost ~100 ms per user and
 * prove nothing.
 */
export function createUser(role: Role, overrides: { name?: string; email?: string } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${unique()}`,
      email: overrides.email ?? `${role.toLowerCase()}-${unique()}@test.local`,
      passwordHash: "test-hash",
      role,
    },
  })
}

export function createCustomer(overrides: { name?: string; email?: string; userId?: string } = {}) {
  return prisma.customer.create({
    data: {
      name: overrides.name ?? `Customer ${unique()}`,
      email: overrides.email ?? `customer-${unique()}@test.local`,
      phone: "+1 555 0100",
      userId: overrides.userId ?? null,
    },
  })
}

export function createTicket(input: {
  customerId: string
  status?: TicketStatus
  priority?: TicketPriority
  assignedAgentId?: string | null
  createdAt?: Date
  dueAt?: Date | null
}) {
  const priority = input.priority ?? "MEDIUM"
  return prisma.ticket.create({
    data: {
      subject: `Ticket ${unique()}`,
      description: "Fixture ticket.",
      category: "Billing",
      priority,
      status: input.status ?? "OPEN",
      customerId: input.customerId,
      assignedAgentId: input.assignedAgentId ?? null,
      createdAt: input.createdAt,
      dueAt: input.dueAt === undefined ? defaultDueAt(priority) : input.dueAt,
    },
  })
}
