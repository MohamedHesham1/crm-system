import { prisma } from "@/lib/prisma"
import { readAttachmentBytes } from "@/lib/attachment-storage"
import { getBrandSettings } from "@/lib/branding"
import { notFound, withAuth } from "@/lib/api/http"
import { BRAND_LOGO_CONTENT_TYPES } from "@/lib/validation/branding"

export const GET = withAuth({ role: "public" }, async () => {
  const settings = await getBrandSettings()
  if (!settings.logoAttachmentId) return notFound("Organization logo not found.")

  const attachment = await prisma.attachment.findUnique({
    where: { id: settings.logoAttachmentId },
    select: { storageKey: true, contentType: true, size: true },
  })
  if (
    !attachment ||
    !(BRAND_LOGO_CONTENT_TYPES as readonly string[]).includes(attachment.contentType)
  ) {
    return notFound("Organization logo not found.")
  }

  try {
    const bytes = await readAttachmentBytes(attachment.storageKey)
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.size),
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return notFound("Organization logo file is missing.")
    }
    throw error
  }
})
