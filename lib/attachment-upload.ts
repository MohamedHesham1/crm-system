import { MAX_ATTACHMENT_SIZE } from "@/lib/attachments"

const MAX_MULTIPART_OVERHEAD = 64 * 1024

export async function readAttachmentUpload(request: Request): Promise<File | Response> {
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const parsedLength = Number(contentLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength > MAX_ATTACHMENT_SIZE + MAX_MULTIPART_OVERHEAD) {
      return Response.json({ error: "Upload must be 10 MiB or smaller." }, { status: 413 })
    }
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Upload must be a multipart form with a file." }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a file to upload." }, { status: 400 })
  }
  return file
}
