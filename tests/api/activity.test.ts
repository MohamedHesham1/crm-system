vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { PATCH } from "@/app/api/tickets/[id]/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("activity side effects", () => {
  it("writes an audit row on a status change", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id, status: "OPEN" })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await PATCH(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "PATCH", { status: "IN_PROGRESS" }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(200)

    const rows = await prisma.auditLog.findMany({ where: { entityId: ticket.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe("STATUS_CHANGED")
    expect(rows[0].actorId).toBe(agent.id)
    expect(rows[0].detail).toContain("from OPEN to IN_PROGRESS")
  })

  it("notifies the agent who gains a ticket", async () => {
    const admin = await createUser("ADMIN")
    const agentB = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id, assignedAgentId: null })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const response = await PATCH(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "PATCH", { assignedAgentId: agentB.id }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(200)

    const notifications = await prisma.notification.findMany({ where: { relatedTicketId: ticket.id } })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe(agentB.id)
    expect(notifications[0].type).toBe("TICKET_ASSIGNED")
    expect(notifications[0].read).toBe(false)
    expect(notifications.some((n) => n.userId === admin.id)).toBe(false)
  })
})
