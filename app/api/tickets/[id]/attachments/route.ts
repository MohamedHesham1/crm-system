import { createAttachment, ATTACHMENT_SELECT, attachmentErrorResponse } from "@/lib/attachments"
import { readAttachmentUpload } from "@/lib/attachment-upload"
import { prisma } from "@/lib/prisma"
import { notFound, withAuth } from "@/lib/api/http"
import { ticketScopeWhere } from "@/lib/ticket-access"

export const GET = withAuth(
  { role: "viewer", permission: "TICKETS_READ" },
  async (_request, ctx: { params: Promise<{ id: string }> }, viewer) => {
    const { id } = await ctx.params
    const ticket = await prisma.ticket.findFirst({
      where: { id, ...ticketScopeWhere(viewer) },
      select: { id: true },
    })
    if (!ticket) return notFound("Ticket not found.")

    const attachments = await prisma.attachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      select: ATTACHMENT_SELECT,
    })
    return Response.json({ attachments })
  },
)

export const POST = withAuth(
  { role: "viewer", permission: "TICKETS_MANAGE" },
  async (request, ctx: { params: Promise<{ id: string }> }, viewer) => {
    const { id } = await ctx.params
    const ticket = await prisma.ticket.findFirst({
      where: { id, ...ticketScopeWhere(viewer) },
      select: { id: true },
    })
    if (!ticket) return notFound("Ticket not found.")

    const upload = await readAttachmentUpload(request)
    if (upload instanceof Response) return upload

    try {
      const attachment = await createAttachment({
        file: upload,
        uploaderId: viewer.id,
        ticketId: id,
      })
      return Response.json({ attachment }, { status: 201 })
    } catch (error) {
      return attachmentErrorResponse(error)
    }
  },
)
