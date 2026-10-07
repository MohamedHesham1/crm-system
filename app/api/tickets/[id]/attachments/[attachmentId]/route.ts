import {
  attachmentDownloadHeaders,
  attachmentErrorResponse,
  deleteAttachment,
} from "@/lib/attachments"
import { readAttachmentBytes } from "@/lib/attachment-storage"
import { prisma } from "@/lib/prisma"
import { notFound, withAuth } from "@/lib/api/http"
import { ticketScopeWhere } from "@/lib/ticket-access"

export const GET = withAuth(
  { role: "viewer", permission: "TICKETS_READ" },
  async (
    _request,
    ctx: { params: Promise<{ id: string; attachmentId: string }> },
    viewer,
  ) => {
    const { id, attachmentId } = await ctx.params
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticketId: id,
        ticket: { is: ticketScopeWhere(viewer) },
      },
    })
    if (!attachment) return notFound("Attachment not found.")

    try {
      const bytes = await readAttachmentBytes(attachment.storageKey)
      return new Response(new Uint8Array(bytes), {
        headers: attachmentDownloadHeaders(attachment),
      })
    } catch (error) {
      return attachmentErrorResponse(error)
    }
  },
)

export const DELETE = withAuth(
  { role: "viewer", permission: "TICKETS_MANAGE" },
  async (
    _request,
    ctx: { params: Promise<{ id: string; attachmentId: string }> },
    viewer,
  ) => {
    const { id, attachmentId } = await ctx.params
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticketId: id,
        ticket: { is: ticketScopeWhere(viewer) },
      },
      select: { id: true, storageKey: true, uploaderId: true },
    })
    if (!attachment || (viewer.kind !== "staff" && attachment.uploaderId !== viewer.id)) {
      return notFound("Attachment not found.")
    }

    try {
      await deleteAttachment(attachment.id, attachment.storageKey)
      return Response.json({ ok: true })
    } catch (error) {
      return attachmentErrorResponse(error)
    }
  },
)
