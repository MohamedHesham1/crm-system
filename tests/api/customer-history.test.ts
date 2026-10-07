vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET, PATCH } from "@/app/api/customers/[id]/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("customer ticket history API", () => {
  it("returns only that customer's non-deleted tickets, newest first", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const otherCustomer = await createCustomer()
    const old = await createTicket({
      customerId: customer.id,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })
    const recent = await createTicket({
      customerId: customer.id,
      createdAt: new Date("2026-02-01T00:00:00Z"),
    })
    await createTicket({ customerId: otherCustomer.id })
    const deleted = await createTicket({ customerId: customer.id })
    await prisma.ticket.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await GET(new Request("http://test"), routeContext({ id: customer.id }))
    expect(response.status).toBe(200)
    const { customer: result } = await response.json()
    expect(result.tickets.map((ticket: { id: string }) => ticket.id)).toEqual([recent.id, old.id])

    const updated = await PATCH(
      jsonRequest("http://test", "PATCH", { notes: "Updated notes." }),
      routeContext({ id: customer.id }),
    )
    const { customer: updatedCustomer } = await updated.json()
    expect(updatedCustomer.notes).toBe("Updated notes.")
    expect(updatedCustomer.tickets.map((ticket: { id: string }) => ticket.id)).toEqual([
      recent.id,
      old.id,
    ])
  })
})
