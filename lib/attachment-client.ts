import { request } from "@/lib/api/client"

export type AttachmentItem = {
  id: string
  originalName: string
  contentType: string
  size: number
  createdAt: string
  uploaderId: string
  uploader: { id: string; name: string }
}

export type AttachmentOwner = { type: "ticket" | "customer"; id: string }

function attachmentPath(owner: AttachmentOwner): string {
  const collection = owner.type === "ticket" ? "tickets" : "customers"
  return `/api/${collection}/${encodeURIComponent(owner.id)}/attachments`
}

export async function fetchAttachments(owner: AttachmentOwner): Promise<AttachmentItem[]> {
  const { attachments } = await request<{ attachments: AttachmentItem[] }>(attachmentPath(owner))
  return attachments
}

export async function uploadAttachment(owner: AttachmentOwner, file: File): Promise<AttachmentItem> {
  const form = new FormData()
  form.append("file", file)
  const { attachment } = await request<{ attachment: AttachmentItem }>(attachmentPath(owner), {
    method: "POST",
    body: form,
  })
  return attachment
}

export async function removeAttachment(
  owner: AttachmentOwner,
  attachmentId: string,
): Promise<void> {
  await request<{ ok: true }>(
    `${attachmentPath(owner)}/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  )
}

export function attachmentDownloadPath(owner: AttachmentOwner, attachmentId: string): string {
  return `${attachmentPath(owner)}/${encodeURIComponent(attachmentId)}`
}
