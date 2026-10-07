import { prisma } from "@/lib/prisma"
import { deleteAttachmentBytes, writeAttachmentBytes } from "@/lib/attachment-storage"

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

const MIME_BY_EXTENSION = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
} as const

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AttachmentValidationError"
  }
}

function detectContentType(extension: string, bytes: Uint8Array): string {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)
  let detected: string | null = null

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) detected = "image/png"
  else if (startsWith(0xff, 0xd8, 0xff)) detected = "image/jpeg"
  else if (
    String.fromCharCode(...bytes.subarray(0, 6)) === "GIF87a" ||
    String.fromCharCode(...bytes.subarray(0, 6)) === "GIF89a"
  ) detected = "image/gif"
  else if (
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) detected = "image/webp"
  else if (String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") detected = "application/pdf"
  else if (extension === ".txt" && bytes.length > 0 && !bytes.includes(0)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      if (/<\s*\/?\s*(?:html|script|svg|iframe|object|embed)\b/i.test(text)) {
        throw new AttachmentValidationError("HTML, script, and SVG content is not allowed.")
      }
      detected = "text/plain"
    } catch (error) {
      if (error instanceof AttachmentValidationError) throw error
      detected = null
    }
  }

  if (!detected || MIME_BY_EXTENSION[extension as keyof typeof MIME_BY_EXTENSION] !== detected) {
    throw new AttachmentValidationError("File must be a valid PNG, JPEG, GIF, WebP, PDF, or UTF-8 text file.")
  }
  return detected
}

export async function createAttachment(input: {
  file: File
  uploaderId: string
  ticketId?: string
  customerId?: string
}) {
  if (input.file.size < 1) throw new AttachmentValidationError("Empty files cannot be uploaded.")
  if (input.file.size > MAX_ATTACHMENT_SIZE) {
    throw new AttachmentValidationError("File must be 10 MiB or smaller.")
  }

  const originalName = input.file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  if (!originalName) throw new AttachmentValidationError("File name is required.")
  if (originalName.length > 255) {
    throw new AttachmentValidationError("File name must be 255 characters or fewer.")
  }
  const extension = originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
  if (!(extension in MIME_BY_EXTENSION)) {
    throw new AttachmentValidationError("File extension is not allowed.")
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer())
  const contentType = detectContentType(extension, bytes)
  const storageKey = await writeAttachmentBytes(bytes)

  try {
    return await prisma.attachment.create({
      data: {
        storageKey,
        originalName,
        contentType,
        size: bytes.byteLength,
        uploaderId: input.uploaderId,
        ticketId: input.ticketId,
        customerId: input.customerId,
      },
      select: {
        id: true,
        originalName: true,
        contentType: true,
        size: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } },
      },
    })
  } catch (error) {
    try {
      await deleteAttachmentBytes(storageKey)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Attachment metadata failed and stored bytes could not be cleaned up.",
      )
    }
    throw error
  }
}

export const ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  contentType: true,
  size: true,
  createdAt: true,
  uploaderId: true,
  uploader: { select: { id: true, name: true } },
} as const

export function attachmentErrorResponse(error: unknown): Response {
  if (error instanceof AttachmentValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  console.error("Attachment operation failed.", error)
  return Response.json({ error: "Could not complete the attachment operation." }, { status: 500 })
}

export function attachmentDownloadHeaders(input: {
  contentType: string
  originalName: string
  size: number
}): Headers {
  const safeName = input.originalName.replace(/[^\x20-\x7e"\\]/g, "_")
  const encodedName = encodeURIComponent(input.originalName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return new Headers({
    "Content-Type": input.contentType,
    "Content-Length": String(input.size),
    "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  })
}

export async function deleteAttachment(id: string, storageKey: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id } })
    await deleteAttachmentBytes(storageKey)
  })
}
