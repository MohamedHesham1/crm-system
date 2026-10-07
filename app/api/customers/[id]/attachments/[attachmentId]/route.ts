import {
  attachmentDownloadHeaders,
  attachmentErrorResponse,
  deleteAttachment,
} from "@/lib/attachments"
import { readAttachmentBytes } from "@/lib/attachment-storage"
import { prisma } from "@/lib/prisma"
import { notFound, withAuth } from "@/lib/api/http"

export const GET = withAuth(
  { role: "agent" },
  async (
    _request,
    ctx: { params: Promise<{ id: string; attachmentId: string }> },
  ) => {
    const { id, attachmentId } = await ctx.params
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, customerId: id },
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
  { role: "agent" },
  async (
    _request,
    ctx: { params: Promise<{ id: string; attachmentId: string }> },
  ) => {
    const { id, attachmentId } = await ctx.params
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, customerId: id },
      select: { id: true, storageKey: true },
    })
    if (!attachment) return notFound("Attachment not found.")

    try {
      await deleteAttachment(attachment.id, attachment.storageKey)
      return Response.json({ ok: true })
    } catch (error) {
      return attachmentErrorResponse(error)
    }
  },
)
