vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/tickets/[id]/timeline/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { routeContext } from "@/tests/helpers/request"

describe("ticket timeline API", () => {
  it("returns ticket comments and audit history to staff only", async () => {
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    const commentAuthor = await createUser("AGENT")
    const publicComment = await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: commentAuthor.id, body: "Customer-visible reply." },
    })
    const internalNote = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: commentAuthor.id,
        body: "Staff-only note.",
        isInternal: true,
      },
    })
    await prisma.auditLog.create({
      data: {
        entityType: "Ticket",
        entityId: ticket.id,
        action: "STATUS_CHANGED",
        actorId: agent.id,
        detail: "Status changed.",
      },
    })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await GET(new Request("http://test"), routeContext({ id: ticket.id }))
    const { timeline } = await response.json()
    expect(timeline.ticket.id).toBe(ticket.id)
    expect(timeline.comments.map((comment: { id: string }) => comment.id)).toEqual([
      publicComment.id,
      internalNote.id,
    ])
    expect(timeline.auditLogs).toHaveLength(1)

    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    expect((await GET(new Request("http://test"), routeContext({ id: ticket.id }))).status).toBe(403)
  })

  it("hides deleted tickets and their dangling audit rows", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    await prisma.auditLog.create({
      data: {
        entityType: "Ticket",
        entityId: ticket.id,
        action: "TICKET_DELETED",
        actorId: agent.id,
        detail: "Deleted ticket.",
      },
    })
    await prisma.ticket.update({ where: { id: ticket.id }, data: { deletedAt: new Date() } })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    expect((await GET(new Request("http://test"), routeContext({ id: ticket.id }))).status).toBe(404)
  })
})
