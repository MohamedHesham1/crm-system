vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import {
  GET as getComments,
  POST as postComment,
} from "@/app/api/tickets/[id]/comments/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("comment mentions API", () => {
  it("deduplicates mentions and notifies staff once, excluding comment author", async () => {
    const author = await createUser("AGENT")
    const recipient = await createUser("ADMIN")
    const customer = await createCustomer()
    const ticket = await createTicket({
      customerId: customer.id,
      assignedAgentId: recipient.id,
    })
    signInAs({ id: author.id, name: author.name, role: "AGENT" })

    const response = await postComment(
      jsonRequest("http://test", "POST", {
        body: "Please review this case.",
        mentionedUserIds: [recipient.id, recipient.id, author.id],
      }),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(201)
    const { comment } = await response.json()
    expect(comment.mentions.map((mention: { user: { id: string } }) => mention.user.id).sort()).toEqual(
      [recipient.id, author.id].sort(),
    )
    expect(await prisma.commentMention.count({ where: { commentId: comment.id } })).toBe(2)
    expect(
      await prisma.notification.count({
        where: { relatedTicketId: ticket.id, type: "COMMENT_MENTIONED" },
      }),
    ).toBe(1)
    expect(
      await prisma.notification.findMany({
        where: { relatedTicketId: ticket.id, userId: recipient.id },
        select: { type: true },
      }),
    ).toEqual([{ type: "COMMENT_MENTIONED" }])
    expect(
      await prisma.notification.count({ where: { userId: author.id, relatedTicketId: ticket.id } }),
    ).toBe(0)
  })

  it("rejects invalid recipients atomically and hides mention metadata from customers", async () => {
    const author = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: author.id, name: author.name, role: "AGENT" })

    const invalid = await postComment(
      jsonRequest("http://test", "POST", {
        body: "Invalid recipient",
        mentionedUserIds: [customerUser.id],
      }),
      routeContext({ id: ticket.id }),
    )
    expect(invalid.status).toBe(400)
    expect(await prisma.comment.count({ where: { ticketId: ticket.id } })).toBe(0)

    const recipient = await createUser("AGENT")
    await postComment(
      jsonRequest("http://test", "POST", {
        body: "Public reply",
        mentionedUserIds: [recipient.id],
      }),
      routeContext({ id: ticket.id }),
    )
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    const portalResponse = await getComments(
      new Request("http://test"),
      routeContext({ id: ticket.id }),
    )
    const { comments } = await portalResponse.json()
    expect(comments).toHaveLength(1)
    expect(comments[0]).not.toHaveProperty("mentions")

    const forbidden = await postComment(
      jsonRequest("http://test", "POST", {
        body: "Customer mentions staff",
        mentionedUserIds: [recipient.id],
      }),
      routeContext({ id: ticket.id }),
    )
    expect(forbidden.status).toBe(403)
    expect(await prisma.comment.count({ where: { ticketId: ticket.id } })).toBe(1)
  })
})
