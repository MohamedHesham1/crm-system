import { createAttachment, ATTACHMENT_SELECT, attachmentErrorResponse } from "@/lib/attachments"
import { readAttachmentUpload } from "@/lib/attachment-upload"
import { prisma } from "@/lib/prisma"
import { notFound, withAuth } from "@/lib/api/http"

export const GET = withAuth(
  { role: "agent" },
  async (_request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } })
    if (!customer) return notFound("Customer not found.")

    const attachments = await prisma.attachment.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
      select: ATTACHMENT_SELECT,
    })
    return Response.json({ attachments })
  },
)

export const POST = withAuth(
  { role: "agent" },
  async (request, ctx: { params: Promise<{ id: string }> }, viewer) => {
    const { id } = await ctx.params
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } })
    if (!customer) return notFound("Customer not found.")

    const upload = await readAttachmentUpload(request)
    if (upload instanceof Response) return upload

    try {
      const attachment = await createAttachment({
        file: upload,
        uploaderId: viewer.id,
        customerId: id,
      })
      return Response.json({ attachment }, { status: 201 })
    } catch (error) {
      return attachmentErrorResponse(error)
    }
  },
)
