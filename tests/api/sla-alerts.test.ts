vi.mock("@/auth", () => import("@/tests/mocks/auth"))

import { afterEach, describe, expect, it, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"

const SECRET = "test-only-cron-secret"

function cronRequest(token?: string) {
  return new Request("http://test/api/cron/sla-alerts", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe("SLA breach alert cron API", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails closed when secret is missing or bearer token is invalid", async () => {
    const { POST } = await import("@/app/api/cron/sla-alerts/route")
    const customer = await createCustomer()
    const agent = await createUser("AGENT")
    const ticket = await createTicket({
      customerId: customer.id,
      assignedAgentId: agent.id,
      dueAt: new Date(Date.now() - 60_000),
    })
    vi.stubEnv("CRON_SECRET", "")

    expect((await POST(cronRequest(SECRET))).status).toBe(500)
    vi.stubEnv("CRON_SECRET", SECRET)
    expect((await POST(cronRequest())).status).toBe(401)
    expect((await POST(cronRequest("wrong"))).status).toBe(401)
    expect(await prisma.notification.count({ where: { relatedTicketId: ticket.id } })).toBe(0)
  })

  it("alerts only current assignees and preserves read state on repeated calls", async () => {
    const { POST } = await import("@/app/api/cron/sla-alerts/route")
    const agent = await createUser("AGENT")
    const otherAgent = await createUser("AGENT")
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({
      customerId: customer.id,
      assignedAgentId: agent.id,
      status: "ESCALATED",
      dueAt: new Date(Date.now() - 60_000),
    })
    vi.stubEnv("CRON_SECRET", SECRET)

    const first = await POST(cronRequest(SECRET))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ checked: 1 })

    const alert = await prisma.notification.findFirstOrThrow({
      where: { relatedTicketId: ticket.id },
    })
    expect(alert.userId).toBe(agent.id)
    expect(alert.type).toBe("SLA_BREACHED")
    expect(alert.dedupeKey).toContain(agent.id)
    await prisma.notification.update({ where: { id: alert.id }, data: { read: true } })

    await POST(cronRequest(SECRET))
    expect(await prisma.notification.count({ where: { relatedTicketId: ticket.id } })).toBe(1)
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: alert.id } })).read,
    ).toBe(true)
    expect(
      await prisma.notification.count({
        where: { userId: { in: [otherAgent.id, admin.id] }, relatedTicketId: ticket.id },
      }),
    ).toBe(0)

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { assignedAgentId: otherAgent.id, dueAt: new Date(Date.now() - 120_000) },
    })
    await POST(cronRequest(SECRET))
    expect(await prisma.notification.count({ where: { relatedTicketId: ticket.id } })).toBe(2)
  })

  it("skips unassigned, not-breached, terminal, and deleted tickets", async () => {
    const { POST } = await import("@/app/api/cron/sla-alerts/route")
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    await createTicket({
      customerId: customer.id,
      assignedAgentId: null,
      dueAt: new Date(Date.now() - 60_000),
    })
    await createTicket({
      customerId: customer.id,
      assignedAgentId: agent.id,
      dueAt: new Date(Date.now() + 60_000),
    })
    await createTicket({
      customerId: customer.id,
      assignedAgentId: agent.id,
      status: "RESOLVED",
      dueAt: new Date(Date.now() - 60_000),
    })
    const deleted = await createTicket({
      customerId: customer.id,
      assignedAgentId: agent.id,
      dueAt: new Date(Date.now() - 60_000),
    })
    await prisma.ticket.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
    vi.stubEnv("CRON_SECRET", SECRET)

    const response = await POST(cronRequest(SECRET))
    expect(await response.json()).toEqual({ checked: 0 })
    expect(await prisma.notification.count()).toBe(0)
  })
})
