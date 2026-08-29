"use client"

import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { CommentThread } from "@/components/agent/tickets/comment-thread"
import { fetchTicket, ticketKeys } from "@/lib/tickets"

export function PortalTicketDetail({ ticketId }: { ticketId: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => fetchTicket(ticketId),
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading ticket…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load ticket."}
      </p>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{data.subject}</h1>
          <Badge variant="secondary">{data.status}</Badge>
          <Badge variant="outline">{data.priority}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Category: {data.category}</p>
        <p className="text-sm text-muted-foreground">
          Created {new Date(data.createdAt).toLocaleString()}
        </p>
        <p className="whitespace-pre-wrap text-sm">{data.description}</p>
      </div>

      <CommentThread ticketId={ticketId} />
    </div>
  )
}
