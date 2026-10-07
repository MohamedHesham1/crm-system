"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, fetchComments, postComment, ticketKeys } from "@/lib/tickets"
import { createCommentSchema, type CreateCommentInput } from "@/lib/validation/ticket"

const QUICK_REPLIES = [
  {
    id: "investigating",
    label: "We're looking into this",
    text: "Thanks for contacting us. We're looking into this and will update you shortly.",
  },
  {
    id: "more-details",
    label: "Ask for more details",
    text: "Could you share a few more details so we can investigate?",
  },
  {
    id: "resolved",
    label: "Issue resolved",
    text: "We've resolved this issue. Please let us know if you need anything else.",
  },
] as const

/**
 * Shared by the agent and portal detail pages — there must never be a
 * portal-specific copy.
 */
export function CommentThread({
  ticketId,
  canWriteInternalNotes = false,
}: {
  ticketId: string
  canWriteInternalNotes?: boolean
}) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [selectedQuickReply, setSelectedQuickReply] = useState("")

  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.comments(ticketId),
    queryFn: () => fetchComments(ticketId),
    // Near-live thread by polling. 8s sits at the fast end of the 8-10s the
    // acceptance criteria allow. The provider-wide staleTime of 30s
    // (app/providers.tsx:12) is overridden here: without it the first mount
    // after a navigation serves a cached thread and looks frozen until the
    // first interval fires. This is polling, not push — WebSockets are
    // explicitly out of scope.
    refetchInterval: 8_000,
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: (input: CreateCommentInput) => postComment(ticketId, input),
    onSuccess: async () => {
      setBody("")
      setIsInternal(false)
      await queryClient.invalidateQueries({ queryKey: ticketKeys.comments(ticketId) })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createCommentSchema.safeParse({ body, isInternal })
    if (!parsed.success) return
    mutation.mutate(parsed.data)
  }

  function appendQuickReply(replyId: string) {
    const reply = QUICK_REPLIES.find((item) => item.id === replyId)
    if (!reply) return
    setBody((current) => (current.length > 0 ? `${current}\n${reply.text}` : reply.text))
    setSelectedQuickReply("")
  }

  const visibleComments = data?.filter(
    (comment) => canWriteInternalNotes || !comment.isInternal,
  ) ?? []

  return (
    <div className="space-y-4">
      <h2 className="text-title">Comments</h2>

      {isPending ? <Spinner label="Loading comments…" /> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load comments."}
        </p>
      ) : null}

      {!isPending && !isError ? (
        <div className="space-y-3">
          {visibleComments.length === 0 ? (
            <p className="text-meta text-muted-foreground">No comments yet.</p>
          ) : (
            visibleComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3 text-body">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{comment.author.name}</span>
                  <Badge variant={comment.author.role === "CUSTOMER" ? "secondary" : "outline"}>
                    {comment.author.role === "CUSTOMER" ? "Customer" : "Agent"}
                  </Badge>
                  {comment.isInternal ? <Badge variant="secondary">Internal note</Badge> : null}
                  <span className="text-label text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2">
        {canWriteInternalNotes ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-medium">Reply visibility</span>
            <Button
              type="button"
              size="sm"
              variant={isInternal ? "outline" : "secondary"}
              aria-pressed={!isInternal}
              onClick={() => setIsInternal(false)}
            >
              Public reply
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isInternal ? "secondary" : "outline"}
              aria-pressed={isInternal}
              onClick={() => setIsInternal(true)}
            >
              Internal note
            </Button>
            <Select value={selectedQuickReply} onValueChange={appendQuickReply}>
              <SelectTrigger aria-label="Quick replies" size="sm">
                <SelectValue placeholder="Quick replies" />
              </SelectTrigger>
              <SelectContent>
                {QUICK_REPLIES.map((reply) => (
                  <SelectItem key={reply.id} value={reply.id}>
                    {reply.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment…"
        />
        <Button type="submit" size="sm" disabled={mutation.isPending || body.trim().length === 0}>
          {mutation.isPending ? "Posting…" : isInternal ? "Add internal note" : "Post comment"}
        </Button>
        {mutation.isError ? (
          <p role="alert" className="text-meta text-destructive">
            {mutation.error instanceof ApiError ? mutation.error.message : "Could not post comment."}
          </p>
        ) : null}
      </form>
    </div>
  )
}
