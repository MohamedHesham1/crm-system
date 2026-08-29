"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchTickets, ticketKeys } from "@/lib/tickets"

export function PortalTicketList() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.list(),
    queryFn: () => fetchTickets(),
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading tickets…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load tickets."}
      </p>
    )
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">You have no tickets yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell>
              <Link href={`/portal/tickets/${ticket.id}`} className="font-medium hover:underline">
                {ticket.subject}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{ticket.status}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{ticket.priority}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
