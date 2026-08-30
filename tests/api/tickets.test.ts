vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/tickets/route"
import { PATCH } from "@/app/api/tickets/[id]/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("tickets API", () => {
  it("creates, claims and resolves a ticket", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const createResponse = await POST(
      jsonRequest("http://test/api/tickets", "POST", {
        subject: "Cannot log in",
        description: "Password reset link is broken.",
        category: "Account",
        priority: "MEDIUM",
        customerId: customer.id,
      }),
    )
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()
    expect(created.ticket.status).toBe("OPEN")
    expect(created.ticket.assignedAgent).toBeNull()

    const claimResponse = await PATCH(
      jsonRequest(`http://test/api/tickets/${created.ticket.id}`, "PATCH", {
        assignedAgentId: agent.id,
      }),
      routeContext({ id: created.ticket.id }),
    )
    expect(claimResponse.status).toBe(200)
    const claimed = await claimResponse.json()
    expect(claimed.ticket.assignedAgent.id).toBe(agent.id)

    const resolveResponse = await PATCH(
      jsonRequest(`http://test/api/tickets/${created.ticket.id}`, "PATCH", {
        status: "RESOLVED",
      }),
      routeContext({ id: created.ticket.id }),
    )
    expect(resolveResponse.status).toBe(200)

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: created.ticket.id } })
    expect(stored.resolvedAt).not.toBeNull()
  })

  it("refuses to move a closed ticket out of CLOSED", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id, status: "CLOSED" })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await PATCH(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "PATCH", { status: "OPEN" }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("This ticket is closed. Use the reopen action to move it back to OPEN.")

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.status).toBe("CLOSED")
  })

  it("forbids a non-admin agent reassigning to another agent", async () => {
    const agentA = await createUser("AGENT")
    const agentB = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id, assignedAgentId: null })
    signInAs({ id: agentA.id, name: agentA.name, role: "AGENT" })

    const response = await PATCH(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "PATCH", { assignedAgentId: agentB.id }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Only an admin can assign a ticket to another agent.")

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.assignedAgentId).toBeNull()
  })

  it("allows an admin to perform the same reassignment", async () => {
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

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored.assignedAgentId).toBe(agentB.id)
  })
})
