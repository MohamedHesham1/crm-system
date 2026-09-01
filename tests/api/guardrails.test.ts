vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET as getCustomers } from "@/app/api/customers/route"
import { GET as getTickets } from "@/app/api/tickets/route"
import { GET as getTicket, DELETE as deleteTicket } from "@/app/api/tickets/[id]/route"
import { GET as getDashboard } from "@/app/api/dashboard/route"
import { POST as postRegister } from "@/app/api/register/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("pagination", () => {
  it("paginates tickets and reports the total", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    for (let i = 0; i < 5; i++) {
      await createTicket({ customerId: customer.id })
    }
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const page1 = await getTickets(new Request("http://test/api/tickets?pageSize=2&page=1"))
    expect(page1.status).toBe(200)
    const body1 = await page1.json()
    expect(body1.tickets).toHaveLength(2)
    expect(body1.total).toBe(5)
    expect(body1.page).toBe(1)
    expect(body1.pageSize).toBe(2)

    const page2 = await getTickets(new Request("http://test/api/tickets?pageSize=2&page=2"))
    const body2 = await page2.json()
    expect(body2.tickets).toHaveLength(2)
    expect(body2.page).toBe(2)

    const page1Ids = new Set(body1.tickets.map((t: { id: string }) => t.id))
    const page2Ids = new Set(body2.tickets.map((t: { id: string }) => t.id))
    expect([...page1Ids].some((id) => page2Ids.has(id))).toBe(false)
  })

  it("clamps pageSize and page to legal values", async () => {
    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await getTickets(new Request("http://test/api/tickets?pageSize=9999&page=0"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.pageSize).toBe(100)
    expect(body.page).toBe(1)
  })

  it("paginates customers", async () => {
    const agent = await createUser("AGENT")
    await createCustomer()
    await createCustomer()
    await createCustomer()
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await getCustomers(new Request("http://test/api/customers?pageSize=1"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.customers).toHaveLength(1)
    expect(body.total).toBe(3)
  })

  it("still answers GET() with no request", async () => {
    const agent = await createUser("AGENT")
    await createCustomer()
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await getCustomers()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.page).toBe(1)
  })
})

describe("rate limiting", () => {
  function registerRequest(email: string, ip: string): Request {
    return new Request("http://test/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: "Test User", email, password: "password123" }),
    })
  }

  it("throttles repeated registrations from one IP", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await postRegister(registerRequest(`user${i}@test.local`, "1.2.3.4"))
      expect(response.status).toBe(201)
    }

    const sixth = await postRegister(registerRequest("user5@test.local", "1.2.3.4"))
    expect(sixth.status).toBe(429)
    expect(sixth.headers.get("Retry-After")).not.toBeNull()
    expect(await prisma.user.count()).toBe(5)
  })

  it("throttles per IP, not globally", async () => {
    for (let i = 0; i < 5; i++) {
      await postRegister(registerRequest(`userA${i}@test.local`, "1.2.3.4"))
    }
    const throttled = await postRegister(registerRequest("userA5@test.local", "1.2.3.4"))
    expect(throttled.status).toBe(429)

    const otherIp = await postRegister(registerRequest("userB0@test.local", "5.6.7.8"))
    expect(otherIp.status).toBe(201)
  })
})

describe("soft delete", () => {
  it("soft-deletes a ticket and keeps its audit row resolvable", async () => {
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const response = await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(200)

    const stored = await prisma.ticket.findUnique({ where: { id: ticket.id } })
    expect(stored).not.toBeNull()
    expect(stored?.deletedAt).not.toBeNull()

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityId: ticket.id, action: "TICKET_DELETED" },
    })
    expect(auditRow).not.toBeNull()

    const resolvedTicket = await prisma.ticket.findUnique({ where: { id: auditRow!.entityId } })
    expect(resolvedTicket).not.toBeNull()
  })

  it("hides a soft-deleted ticket from the list and the detail", async () => {
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const before = await getTickets(new Request("http://test/api/tickets"))
    const beforeBody = await before.json()
    expect(beforeBody.total).toBe(1)

    await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )

    const after = await getTickets(new Request("http://test/api/tickets"))
    const afterBody = await after.json()
    expect(afterBody.total).toBe(0)
    expect(afterBody.tickets.find((t: { id: string }) => t.id === ticket.id)).toBeUndefined()

    const detail = await getTicket(
      new Request(`http://test/api/tickets/${ticket.id}`),
      routeContext({ id: ticket.id }),
    )
    expect(detail.status).toBe(404)
  })

  it("excludes soft-deleted tickets from the dashboard counts", async () => {
    const agent = await createUser("AGENT")
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({
      customerId: customer.id,
      status: "OPEN",
      assignedAgentId: agent.id,
    })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const before = await getDashboard()
    const beforeBody = await before.json()
    expect(beforeBody.assigned.total).toBe(1)
    const queueUnassignedBefore = beforeBody.queue.unassigned

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )

    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const after = await getDashboard()
    const afterBody = await after.json()
    expect(afterBody.assigned.total).toBe(0)
    expect(afterBody.queue.unassigned).toBe(queueUnassignedBefore)
  })

  it("refuses a second delete of the same ticket", async () => {
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )
    const second = await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )
    expect(second.status).toBe(404)
  })

  it("still refuses a non-admin ticket delete", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await deleteTicket(
      jsonRequest(`http://test/api/tickets/${ticket.id}`, "DELETE", {}),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(403)

    const stored = await prisma.ticket.findUnique({ where: { id: ticket.id } })
    expect(stored?.deletedAt).toBeNull()
  })
})

describe("withAuth migration keeps outcomes unchanged", () => {
  it("keeps the existing 401/403 outcomes for /api/customers", async () => {
    signInAs(null)
    const signedOut = await getCustomers(new Request("http://test/api/customers"))
    expect(signedOut.status).toBe(401)

    const customerUser = await createUser("CUSTOMER")
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    const asCustomer = await getCustomers(new Request("http://test/api/customers"))
    expect(asCustomer.status).toBe(403)

    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const asAgent = await getCustomers(new Request("http://test/api/customers"))
    expect(asAgent.status).toBe(200)
  })
})
