import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TicketListItem } from "@/lib/tickets"

export function AssignedTicketList({ tickets }: { tickets: TicketListItem[] }) {
  if (tickets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nothing is assigned to you right now.</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell>
              <Link href={`/agent/tickets/${ticket.id}`} className="font-medium hover:underline">
                {ticket.subject}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{ticket.customer.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{ticket.priority}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{ticket.status}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              <div className="flex items-center gap-2">
                {ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : "—"}
                {ticket.slaBreached ? <Badge variant="destructive">SLA breached</Badge> : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
