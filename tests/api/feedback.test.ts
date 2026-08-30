vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/tickets/[id]/feedback/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("feedback API", () => {
  it("rejects feedback on a ticket that is not resolved", async () => {
    const user = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: user.id })
    const ticket = await createTicket({ customerId: customer.id, status: "OPEN" })
    signInAs({ id: user.id, name: user.name, role: "CUSTOMER" })

    const response = await POST(
      jsonRequest(`http://test/api/tickets/${ticket.id}/feedback`, "POST", { rating: 5 }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("You can rate this ticket once it has been resolved.")
    expect(await prisma.feedback.count()).toBe(0)
  })

  it("accepts feedback on a resolved ticket", async () => {
    const user = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: user.id })
    const ticket = await createTicket({ customerId: customer.id, status: "RESOLVED" })
    signInAs({ id: user.id, name: user.name, role: "CUSTOMER" })

    const response = await POST(
      jsonRequest(`http://test/api/tickets/${ticket.id}/feedback`, "POST", {
        rating: 4,
        comment: "Quick fix.",
      }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.feedback.rating).toBe(4)

    const stored = await prisma.feedback.findUniqueOrThrow({ where: { ticketId: ticket.id } })
    expect(stored.ticketId).toBe(ticket.id)
  })
})
