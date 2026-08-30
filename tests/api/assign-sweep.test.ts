vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"

describe("assignment sweep", () => {
  it("claims an eligible aging ticket for the least loaded agent", async () => {
    const { POST } = await import("@/app/api/tickets/assign-sweep/route")
    const admin = await createUser("ADMIN")
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const now = Date.now()

    const aging = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      dueAt: new Date(now + 1 * 60 * 60 * 1000),
    })
    const control = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(now),
      dueAt: new Date(now + 24 * 60 * 60 * 1000),
    })

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const response = await POST()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.swept).toBe(1)
    expect(body.assignments[0].ticketId).toBe(aging.id)

    const storedAging = await prisma.ticket.findUniqueOrThrow({ where: { id: aging.id } })
    expect(storedAging.assignedAgentId).toBe(agent.id)

    const storedControl = await prisma.ticket.findUniqueOrThrow({ where: { id: control.id } })
    expect(storedControl.assignedAgentId).toBeNull()
  })

  it("records the same audit row and notification as a manual claim", async () => {
    const { POST } = await import("@/app/api/tickets/assign-sweep/route")
    const admin = await createUser("ADMIN")
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const now = Date.now()

    const aging = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      dueAt: new Date(now + 1 * 60 * 60 * 1000),
    })

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    await POST()

    const auditRows = await prisma.auditLog.findMany({ where: { entityId: aging.id } })
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0].action).toBe("ASSIGNED")
    expect(auditRows[0].detail).toContain("assignment sweep")

    const notifications = await prisma.notification.findMany({ where: { relatedTicketId: aging.id } })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].userId).toBe(agent.id)
    expect(notifications[0].type).toBe("TICKET_ASSIGNED")
  })

  it("rolls back completely when one assignment fails", async () => {
    const notifyCalls = { count: 0 }

    vi.resetModules()
    vi.doMock("@/lib/activity", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/activity")>()
      return {
        ...actual,
        notify: async (...args: Parameters<typeof actual.notify>) => {
          notifyCalls.count += 1
          if (notifyCalls.count === 2) throw new Error("boom")
          return actual.notify(...args)
        },
      }
    })

    const { POST } = await import("@/app/api/tickets/assign-sweep/route")
    const admin = await createUser("ADMIN")
    await createUser("AGENT")
    const customer = await createCustomer()
    const now = Date.now()

    const ticketA = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      dueAt: new Date(now + 1 * 60 * 60 * 1000),
    })
    const ticketB = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: new Date(now - 3 * 60 * 60 * 1000),
      dueAt: new Date(now + 1 * 60 * 60 * 1000),
    })

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    await expect(POST()).rejects.toThrow("boom")
    expect(notifyCalls.count).toBe(2)

    const storedA = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketA.id } })
    const storedB = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketB.id } })
    expect(storedA.assignedAgentId).toBeNull()
    expect(storedB.assignedAgentId).toBeNull()
    expect(await prisma.auditLog.count()).toBe(0)
    expect(await prisma.notification.count()).toBe(0)

    vi.doUnmock("@/lib/activity")
    vi.resetModules()
  })
})
