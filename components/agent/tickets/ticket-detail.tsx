"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { AttachmentPanel } from "@/components/shared/attachment-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SlaBadge } from "@/components/ui/sla-badge"
import { Spinner } from "@/components/ui/spinner"
import { CommentThread } from "@/components/agent/tickets/comment-thread"
import { ApiError, fetchTicket, fetchTicketTimeline, reopenTicket, ticketKeys, updateTicket } from "@/lib/tickets"
import { fetchUsers, userKeys } from "@/lib/users"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validation/ticket"

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const isAdmin = session?.user.role === "ADMIN"

  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => fetchTicket(ticketId),
  })

  const { data: agents } = useQuery({
    queryKey: userKeys.list(),
    queryFn: fetchUsers,
    enabled: isAdmin,
  })

  const timelineQuery = useQuery({
    queryKey: ticketKeys.timeline(ticketId),
    queryFn: () => fetchTicketTimeline(ticketId),
  })

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTicket>[1]) => updateTicket(ticketId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(ticketKeys.detail(ticketId), updated)
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenTicket(ticketId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(ticketKeys.detail(ticketId), updated)
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
    },
  })

  if (isPending) return <Spinner label="Loading ticket…" />

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load ticket."}
      </p>
    )
  }

  const mutationError =
    updateMutation.error instanceof ApiError
      ? updateMutation.error.message
      : reopenMutation.error instanceof ApiError
        ? reopenMutation.error.message
        : null

  const isClosed = data.status === "CLOSED"
  const viewerId = session?.user.id
  const agentOptions = (agents ?? []).filter((user) => user.role === "AGENT")

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/agent/tickets" className="text-meta text-muted-foreground hover:underline">
        ← All tickets
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-display">{data.subject}</h1>
          {data.slaBreached ? <SlaBadge /> : null}
        </div>
        <p className="text-meta text-muted-foreground">
          Customer:{" "}
          <Link href={`/agent/customers/${data.customer.id}`} className="hover:underline">
            {data.customer.name}
          </Link>
        </p>
        <p className="text-meta text-muted-foreground">Category: {data.category}</p>
        <p className="text-meta text-muted-foreground">
          Assigned to: {data.assignedAgent ? data.assignedAgent.name : "Unassigned"}
        </p>
        <p className="text-meta text-muted-foreground">
          Created {new Date(data.createdAt).toLocaleString()}
        </p>
        <p className="text-meta text-muted-foreground">
          Due {data.dueAt ? new Date(data.dueAt).toLocaleString() : "—"}
        </p>
        <p className="whitespace-pre-wrap text-body">{data.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <p className="text-label uppercase text-muted-foreground">Status</p>
          <Select
            value={data.status}
            disabled={isClosed || updateMutation.isPending}
            onValueChange={(value) =>
              updateMutation.mutate({ status: value as (typeof TICKET_STATUSES)[number] })
            }
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-label uppercase text-muted-foreground">Priority</p>
          <Select
            value={data.priority}
            disabled={updateMutation.isPending}
            onValueChange={(value) =>
              updateMutation.mutate({ priority: value as (typeof TICKET_PRIORITIES)[number] })
            }
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isClosed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reopenMutation.isPending}
            onClick={() => reopenMutation.mutate()}
          >
            {reopenMutation.isPending ? "Reopening…" : "Reopen ticket"}
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <p className="text-label uppercase text-muted-foreground">Assignment</p>

        {data.assignedAgent === null ? (
          <Button
            type="button"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ assignedAgentId: viewerId ?? null })}
          >
            Claim ticket
          </Button>
        ) : data.assignedAgent.id === viewerId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ assignedAgentId: null })}
          >
            Release ticket
          </Button>
        ) : !isAdmin ? (
          <p className="text-meta text-muted-foreground">
            Assigned to {data.assignedAgent.name}
          </p>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {data.assignedAgent !== null && data.assignedAgent.id !== viewerId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ assignedAgentId: null })}
              >
                Release ticket
              </Button>
            ) : null}

            <Select
              value=""
              disabled={updateMutation.isPending}
              onValueChange={(value) => updateMutation.mutate({ assignedAgentId: value })}
            >
              <SelectTrigger size="sm" className="w-48">
                <SelectValue placeholder="Reassign to…" />
              </SelectTrigger>
              <SelectContent>
                {agentOptions.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {mutationError ? (
        <p role="alert" className="text-meta text-destructive">
          {mutationError}
        </p>
      ) : null}

      <section aria-labelledby="ticket-timeline-heading" className="space-y-3">
        <h2 id="ticket-timeline-heading" className="text-title">Ticket timeline</h2>
        {timelineQuery.isPending ? <Spinner label="Loading ticket timeline…" /> : null}
        {timelineQuery.isError ? (
          <p role="alert" className="text-meta text-destructive">
            {timelineQuery.error instanceof Error
              ? timelineQuery.error.message
              : "Could not load ticket timeline."}
          </p>
        ) : null}
        {timelineQuery.data ? (
          <ol className="space-y-3 border-l pl-4">
            <li>
              <p className="text-body font-medium">Ticket created</p>
              <p className="text-meta text-muted-foreground">
                {new Date(timelineQuery.data.ticket.createdAt).toLocaleString()}
              </p>
            </li>
            {[
              ...timelineQuery.data.comments.map((comment) => ({
                id: `comment-${comment.id}`,
                createdAt: comment.createdAt,
                detail: `${comment.author.name}: ${comment.body}`,
                label: comment.isInternal ? "Internal note" : "Comment",
              })),
              ...timelineQuery.data.auditLogs.map((entry) => ({
                id: `audit-${entry.id}`,
                createdAt: entry.createdAt,
                detail: entry.detail,
                label: entry.action.replaceAll("_", " "),
              })),
            ]
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
              .map((event) => (
                <li key={event.id}>
                  <p className="text-label uppercase text-muted-foreground">{event.label}</p>
                  <p className="whitespace-pre-wrap text-body">{event.detail}</p>
                  <p className="text-meta text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
          </ol>
        ) : null}
      </section>

      <CommentThread ticketId={ticketId} canWriteInternalNotes />
      <AttachmentPanel owner={{ type: "ticket", id: ticketId }} allowDeleteAny />
    </div>
  )
}
