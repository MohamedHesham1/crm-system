"use client"

import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  attachmentDownloadPath,
  fetchAttachments,
  removeAttachment,
  uploadAttachment,
  type AttachmentOwner,
} from "@/lib/attachment-client"
import { ApiError } from "@/lib/api/client"

export function AttachmentPanel({
  owner,
  allowDeleteAny = false,
  currentUserId,
}: {
  owner: AttachmentOwner
  allowDeleteAny?: boolean
  currentUserId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const queryKey = ["attachments", owner.type, owner.id] as const
  const { data, isPending, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchAttachments(owner),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(owner, file),
    onSuccess: async () => {
      if (inputRef.current) inputRef.current.value = ""
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => removeAttachment(owner, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const mutationError = uploadMutation.error ?? deleteMutation.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            aria-label="Choose attachment"
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt"
            className="max-w-sm"
            disabled={uploadMutation.isPending}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) uploadMutation.mutate(file)
            }}
          />
          {uploadMutation.isPending ? <Spinner label="Uploading attachment…" /> : null}
        </div>

        {isPending ? <Spinner label="Loading attachments…" /> : null}
        {isError ? (
          <p role="alert" className="text-meta text-destructive">
            {error instanceof Error ? error.message : "Could not load attachments."}
          </p>
        ) : null}
        {data && data.length === 0 ? (
          <p className="text-meta text-muted-foreground">No attachments yet.</p>
        ) : null}
        {data?.map((attachment) => {
          const canDelete =
            allowDeleteAny || attachment.uploaderId === currentUserId
          return (
            <div
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0">
                <a
                  href={attachmentDownloadPath(owner, attachment.id)}
                  className="break-all text-body font-medium underline underline-offset-2"
                  download
                >
                  {attachment.originalName}
                </a>
                <p className="text-label text-muted-foreground">
                  {attachment.uploader.name} · {Math.ceil(attachment.size / 1024)} KB
                </p>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(attachment.id)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          )
        })}
        {mutationError ? (
          <p role="alert" className="text-meta text-destructive">
            {mutationError instanceof ApiError
              ? mutationError.message
              : "Could not complete the attachment operation."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
