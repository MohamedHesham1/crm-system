import { createAttachment, AttachmentValidationError, deleteAttachment } from "@/lib/attachments"
import { prisma } from "@/lib/prisma"
import { DEFAULT_BRANDING, BRAND_SETTINGS_ID, brandingResponse, getBrandSettings } from "@/lib/branding"
import { BRAND_LOGO_CONTENT_TYPES, isBrandLogoFile, validateBrandingContrast, updateBrandingSchema } from "@/lib/validation/branding"
import { readJson, validationError, withAuth } from "@/lib/api/http"
import { readAttachmentBytes } from "@/lib/attachment-storage"

const BRANDING_SELECT = {
  id: true,
  organizationName: true,
  primaryLight: true,
  primaryDark: true,
  accentLight: true,
  accentDark: true,
  logoAttachmentId: true,
} as const

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")
}

async function logoAvailable(attachmentId: string | null): Promise<boolean> {
  if (!attachmentId) return true
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { storageKey: true },
  })
  if (!attachment) return false
  try {
    await readAttachmentBytes(attachment.storageKey)
    return true
  } catch (error) {
    if (isMissingFile(error)) return false
    throw error
  }
}

export const GET = withAuth({ role: "admin" }, async () => {
  const settings = await getBrandSettings()
  return Response.json(brandingResponse(settings, await logoAvailable(settings.logoAttachmentId)))
})

export const PATCH = withAuth({ role: "admin" }, async (request, _ctx, admin) => {
  const body = await readJson(request)
  if (!body.ok) return body.response
  const parsed = updateBrandingSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const contrastErrors = validateBrandingContrast(parsed.data)
  if (Object.keys(contrastErrors).length) {
    return Response.json(
      { error: "Validation failed", fieldErrors: contrastErrors },
      { status: 400 },
    )
  }

  const before = await getBrandSettings()
  const changes = parsed.data
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.brandingSettings.upsert({
      where: { id: BRAND_SETTINGS_ID },
      create: { ...DEFAULT_BRANDING, ...changes },
      update: changes,
      select: BRANDING_SELECT,
    })

    const changedFields = Object.keys(changes).filter(
      (field) => changes[field as keyof typeof changes] !== before[field as keyof typeof before],
    )
    if (changedFields.length) {
      await tx.auditLog.create({
        data: {
          entityType: "BrandingSettings",
          entityId: BRAND_SETTINGS_ID,
          action: "SETTINGS_CHANGED",
          actorId: admin.id,
          detail: `${admin.name} updated organization branding (${changedFields.join(", ")}).`,
        },
      })
    }
    return saved
  })

  return Response.json(brandingResponse(updated))
})

export const POST = withAuth({ role: "admin" }, async (request, _ctx, admin) => {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    return Response.json({ error: "Logo upload must use multipart form data." }, { status: 400 })
  }
  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a logo image to upload." }, { status: 400 })
  }
  if (!isBrandLogoFile(file)) {
    return Response.json(
      { error: "Logo must be a PNG, JPEG, or WebP image no larger than 2 MiB." },
      { status: 400 },
    )
  }

  const before = await getBrandSettings()
  let uploaded: Awaited<ReturnType<typeof createAttachment>>
  try {
    uploaded = await createAttachment({ file, uploaderId: admin.id })
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
  const uploadedStorage = await prisma.attachment.findUniqueOrThrow({
    where: { id: uploaded.id },
    select: { storageKey: true },
  })
  if (!(BRAND_LOGO_CONTENT_TYPES as readonly string[]).includes(uploaded.contentType)) {
    await deleteAttachment(uploaded.id, uploadedStorage.storageKey)
    return Response.json({ error: "Logo must be a PNG, JPEG, or WebP image." }, { status: 400 })
  }

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.brandingSettings.upsert({
        where: { id: BRAND_SETTINGS_ID },
        create: { ...DEFAULT_BRANDING, logoAttachmentId: uploaded.id },
        update: { logoAttachmentId: uploaded.id },
        select: BRANDING_SELECT,
      })
      await tx.auditLog.create({
        data: {
          entityType: "BrandingSettings",
          entityId: BRAND_SETTINGS_ID,
          action: "SETTINGS_CHANGED",
          actorId: admin.id,
          detail: `${admin.name} updated the organization logo.`,
        },
      })
      return saved
    })
  } catch (error) {
    try {
      await deleteAttachment(uploaded.id, uploadedStorage.storageKey)
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Brand settings failed and uploaded logo could not be cleaned up.")
    }
    throw error
  }

  if (before.logoAttachmentId && before.logoAttachmentId !== uploaded.id) {
    await removePreviousLogo(before.logoAttachmentId)
  }
  return Response.json(brandingResponse(updated), { status: 201 })
})

export const DELETE = withAuth({ role: "admin" }, async (_request, _ctx, admin) => {
  const before = await getBrandSettings()
  if (!before.logoAttachmentId) return Response.json(brandingResponse(before))

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.brandingSettings.upsert({
      where: { id: BRAND_SETTINGS_ID },
      create: { ...DEFAULT_BRANDING },
      update: { logoAttachmentId: null },
      select: BRANDING_SELECT,
    })
    await tx.auditLog.create({
      data: {
        entityType: "BrandingSettings",
        entityId: BRAND_SETTINGS_ID,
        action: "SETTINGS_CHANGED",
        actorId: admin.id,
        detail: `${admin.name} removed the organization logo.`,
      },
    })
    return saved
  })
  await removePreviousLogo(before.logoAttachmentId)
  return Response.json(brandingResponse(updated))
})

async function removePreviousLogo(attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storageKey: true },
  })
  if (!attachment) return
  try {
    await deleteAttachment(attachment.id, attachment.storageKey)
  } catch (error) {
    if (isMissingFile(error)) {
      await prisma.attachment.delete({ where: { id: attachment.id } })
      return
    }
    throw error
  }
}
