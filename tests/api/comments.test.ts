vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET as getTicket } from "@/app/api/tickets/[id]/route"
import {
  GET as getComments,
  POST as postComment,
} from "@/app/api/tickets/[id]/comments/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("ticket comments API", () => {
  it("lets staff create and read internal notes", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const created = await postComment(
      jsonRequest(`http://test/api/tickets/${ticket.id}/comments`, "POST", {
        body: "Staff-only investigation notes.",
        isInternal: true,
      }),
      routeContext({ id: ticket.id }),
    )
    expect(created.status).toBe(201)
    expect((await created.json()).comment.isInternal).toBe(true)

    const response = await getComments(
      new Request(`http://test/api/tickets/${ticket.id}/comments`),
      routeContext({ id: ticket.id }),
    )
    expect((await response.json()).comments).toHaveLength(1)
    expect((await prisma.comment.findFirstOrThrow({ where: { ticketId: ticket.id } })).isInternal).toBe(true)
  })

  it("hides internal notes from customer comment and ticket responses", async () => {
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: agent.id, body: "Private note", isInternal: true },
    })
    await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: agent.id, body: "Public comment" },
    })
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })

    const commentsResponse = await getComments(
      new Request(`http://test/api/tickets/${ticket.id}/comments`),
      routeContext({ id: ticket.id }),
    )
    const comments = (await commentsResponse.json()).comments
    expect(comments.map((comment: { body: string }) => comment.body)).toEqual(["Public comment"])
    expect(comments[0].isInternal).toBe(false)

    const ticketResponse = await getTicket(
      new Request(`http://test/api/tickets/${ticket.id}`),
      routeContext({ id: ticket.id }),
    )
    const ticketBody = await ticketResponse.json()
    expect(ticketBody.ticket.comments.map((comment: { body: string }) => comment.body)).toEqual([
      "Public comment",
    ])
  })

  it("rejects customer internal notes and keeps omitted visibility public", async () => {
    const customerUser = await createUser("CUSTOMER")
    const otherCustomerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const otherCustomer = await createCustomer({ userId: otherCustomerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    const otherTicket = await createTicket({ customerId: otherCustomer.id })
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })

    const forbidden = await postComment(
      jsonRequest(`http://test/api/tickets/${ticket.id}/comments`, "POST", {
        body: "Attempted private note.",
        isInternal: true,
      }),
      routeContext({ id: ticket.id }),
    )
    expect(forbidden.status).toBe(403)
    expect(await prisma.comment.count({ where: { ticketId: ticket.id } })).toBe(0)

    const publicResponse = await postComment(
      jsonRequest(`http://test/api/tickets/${ticket.id}/comments`, "POST", {
        body: "A regular customer comment.",
      }),
      routeContext({ id: ticket.id }),
    )
    expect(publicResponse.status).toBe(201)
    expect((await publicResponse.json()).comment.isInternal).toBe(false)

    const unauthorized = await getComments(
      new Request(`http://test/api/tickets/${otherTicket.id}/comments`),
      routeContext({ id: otherTicket.id }),
    )
    expect(unauthorized.status).toBe(404)
  })
})
