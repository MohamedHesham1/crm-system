"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SlaBadge } from "@/components/ui/sla-badge"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ApiError,
  fetchTickets,
  runAssignSweep,
  ticketKeys,
  updateTicket,
  type TicketFilters,
} from "@/lib/tickets"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/validation/ticket"

const ALL = "__all__"

function hasActiveFilters(filters: TicketFilters): boolean {
  return filters.status !== undefined || filters.priority !== undefined || filters.assigned !== undefined
}

export function TicketTable() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<TicketFilters>({})
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => fetchTickets(filters),
    placeholderData: keepPreviousData,
  })

  const claimMutation = useMutation({
    mutationFn: (ticketId: string) =>
      updateTicket(ticketId, { assignedAgentId: session?.user.id ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
    },
  })

  const sweepMutation = useMutation({
    mutationFn: runAssignSweep,
    onSuccess: async (result) => {
      setSweepMessage(
        result.swept === 0 && result.reason
          ? result.reason
          : `Assigned ${result.swept} ticket(s).`,
      )
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status ?? ALL}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              status: value === ALL ? undefined : (value as TicketFilters["status"]),
              page: 1,
            }))
          }
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TICKET_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority ?? ALL}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              priority: value === ALL ? undefined : (value as TicketFilters["priority"]),
              page: 1,
            }))
          }
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assigned ?? ALL}
          onValueChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              assigned: value === ALL ? undefined : (value as TicketFilters["assigned"]),
              page: 1,
            }))
          }
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any assignment</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters(filters) ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFilters({})}>
            Clear filters
          </Button>
        ) : null}

        {session?.user.role === "ADMIN" ? (
          <div className="ml-auto flex items-center gap-2">
            {sweepMessage ? (
              <p className="text-meta text-muted-foreground">{sweepMessage}</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sweepMutation.isPending}
              onClick={() => sweepMutation.mutate()}
            >
              {sweepMutation.isPending ? "Running…" : "Run assignment sweep"}
            </Button>
          </div>
        ) : null}
      </div>

      {isPending ? <Spinner label="Loading tickets…" /> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load tickets."}
        </p>
      ) : null}

      {!isPending && !isError && data.items.length === 0 ? (
        <p className="text-meta text-muted-foreground">No tickets match these filters.</p>
      ) : null}

      {!isPending && !isError && data.items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((ticket) => (
              <TableRow key={ticket.id} data-sla={ticket.slaBreached ? "breached" : undefined}>
                <TableCell>
                  <Link
                    href={`/agent/tickets/${ticket.id}`}
                    className="font-medium hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{ticket.customer.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ticket.priority}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell>
                  {ticket.assignedAgent ? (
                    ticket.assignedAgent.name
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Unassigned</span>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={claimMutation.isPending}
                        onClick={() => claimMutation.mutate(ticket.id)}
                      >
                        Claim
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : "—"}
                    {ticket.slaBreached ? <SlaBadge /> : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {!isPending && !isError && data.total > data.pageSize ? (
        <div className="flex items-center justify-between">
          <p className="text-meta text-muted-foreground">
            {`Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(
              data.page * data.pageSize,
              data.total,
            )} of ${data.total}`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {claimMutation.isError ? (
        <p role="alert" className="text-meta text-destructive">
          {claimMutation.error instanceof ApiError
            ? claimMutation.error.message
            : "Could not claim ticket."}
        </p>
      ) : null}
    </div>
  )
}
