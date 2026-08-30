"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, fetchComments, postComment, ticketKeys } from "@/lib/tickets"
import { createCommentSchema } from "@/lib/validation/ticket"

/**
 * Shared by the agent and portal detail pages — there must never be a
 * portal-specific copy.
 */
export function CommentThread({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState("")

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
    mutationFn: (text: string) => postComment(ticketId, { body: text }),
    onSuccess: async () => {
      setBody("")
      await queryClient.invalidateQueries({ queryKey: ticketKeys.comments(ticketId) })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createCommentSchema.safeParse({ body })
    if (!parsed.success) return
    mutation.mutate(parsed.data.body)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-title">Comments</h2>

      {isPending ? <p className="text-meta text-muted-foreground">Loading comments…</p> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load comments."}
        </p>
      ) : null}

      {!isPending && !isError ? (
        <div className="space-y-3">
          {data.length === 0 ? (
            <p className="text-meta text-muted-foreground">No comments yet.</p>
          ) : (
            data.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3 text-body">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{comment.author.name}</span>
                  <Badge variant={comment.author.role === "CUSTOMER" ? "secondary" : "outline"}>
                    {comment.author.role === "CUSTOMER" ? "Customer" : "Agent"}
                  </Badge>
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
        <Textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment…"
        />
        <Button type="submit" size="sm" disabled={mutation.isPending || body.trim().length === 0}>
          {mutation.isPending ? "Posting…" : "Post comment"}
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
