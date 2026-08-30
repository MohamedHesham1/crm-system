"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditKeys, fetchAuditLogs } from "@/lib/audit"
import { fetchTickets, ticketKeys } from "@/lib/tickets"

/** Radix rejects a `SelectItem` with `value=""`, so "no filter" needs a sentinel. */
const ALL = "__all__"

export function AuditTable() {
  const [ticketId, setTicketId] = useState<string | undefined>(undefined)

  const { data: tickets } = useQuery({
    queryKey: ticketKeys.list(),
    queryFn: () => fetchTickets(),
  })

  const { data, isPending, isError, error } = useQuery({
    queryKey: auditKeys.list(ticketId),
    queryFn: () => fetchAuditLogs(ticketId),
  })

  const knownTicketIds = new Set((tickets ?? []).map((ticket) => ticket.id))

  return (
    <div className="space-y-4">
      <Select
        value={ticketId ?? ALL}
        onValueChange={(value) => setTicketId(value === ALL ? undefined : value)}
      >
        <SelectTrigger size="sm" className="w-80">
          <SelectValue placeholder="Filter by ticket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tickets</SelectItem>
          {(tickets ?? []).map((ticket) => (
            <SelectItem key={ticket.id} value={ticket.id}>
              {ticket.subject}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending ? <p className="text-meta text-muted-foreground">Loading activity…</p> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load activity."}
        </p>
      ) : null}

      {!isPending && !isError && data.length === 0 ? (
        <p className="text-meta text-muted-foreground">No activity recorded yet.</p>
      ) : null}

      {!isPending && !isError && data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Ticket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell>{log.detail}</TableCell>
                <TableCell className="text-muted-foreground">{log.actor.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {knownTicketIds.has(log.entityId) ? (
                    <Link href={`/agent/tickets/${log.entityId}`} className="hover:underline">
                      Open
                    </Link>
                  ) : (
                    "deleted"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}
