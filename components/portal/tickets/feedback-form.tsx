"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import type { TicketFeedback } from "@/lib/feedback"
import { postFeedback } from "@/lib/feedback"
import { ticketKeys } from "@/lib/tickets"
import { RATING_VALUES, type CreateFeedbackInput } from "@/lib/validation/feedback"
import { cn } from "@/lib/utils"

export function FeedbackForm({
  ticketId,
  feedback,
}: {
  ticketId: string
  feedback: TicketFeedback | null
}) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState("")

  const mutation = useMutation({
    mutationFn: (input: CreateFeedbackInput) => postFeedback(ticketId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) }),
  })

  if (feedback) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>You rated this ticket {feedback.rating}/5</CardTitle>
        </CardHeader>
        {feedback.comment ? (
          <CardContent>
            <p className="whitespace-pre-wrap text-body">{feedback.comment}</p>
          </CardContent>
        ) : null}
      </Card>
    )
  }

  function handleSubmit() {
    if (rating === null) return
    mutation.mutate({ rating, comment: comment.trim() || undefined })
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>How did we do?</CardTitle>
        <CardDescription>Rate your experience with this ticket.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {RATING_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border text-meta font-medium transition-colors",
                rating === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-muted",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-comment">Comment (optional)</Label>
          <Textarea
            id="feedback-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell us more…"
          />
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={rating === null || mutation.isPending}
        >
          {mutation.isPending ? "Submitting…" : "Submit rating"}
        </Button>

        {mutation.isError ? (
          <p role="alert" className="text-meta text-destructive">
            {mutation.error instanceof ApiError ? mutation.error.message : "Could not submit rating."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
