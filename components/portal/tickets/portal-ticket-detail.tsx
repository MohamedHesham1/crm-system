"use client"

import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { CommentThread } from "@/components/agent/tickets/comment-thread"
import { FeedbackForm } from "@/components/portal/tickets/feedback-form"
import { TERMINAL_STATUSES } from "@/lib/sla"
import { fetchTicket, ticketKeys } from "@/lib/tickets"

export function PortalTicketDetail({ ticketId }: { ticketId: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => fetchTicket(ticketId),
  })

  if (isPending) return <p className="text-meta text-muted-foreground">Loading ticket…</p>

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load ticket."}
      </p>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-display">{data.subject}</h1>
          <Badge variant="secondary">{data.status}</Badge>
          <Badge variant="outline">{data.priority}</Badge>
        </div>
        <p className="text-meta text-muted-foreground">Category: {data.category}</p>
        <p className="text-meta text-muted-foreground">
          Created {new Date(data.createdAt).toLocaleString()}
        </p>
        <p className="whitespace-pre-wrap text-body">{data.description}</p>
      </div>

      {TERMINAL_STATUSES.includes(data.status) ? (
        <FeedbackForm ticketId={ticketId} feedback={data.feedback} />
      ) : null}

      <CommentThread ticketId={ticketId} />
    </div>
  )
}
