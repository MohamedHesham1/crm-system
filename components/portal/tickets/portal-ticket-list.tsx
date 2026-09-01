"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchTickets, ticketKeys } from "@/lib/tickets"

export function PortalTicketList() {
  const [page, setPage] = useState(1)

  const { data, isPending, isError, error } = useQuery({
    queryKey: ticketKeys.list({ page }),
    queryFn: () => fetchTickets({ page }),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <p className="text-meta text-muted-foreground">Loading tickets…</p>

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load tickets."}
      </p>
    )
  }

  if (data.items.length === 0) {
    return <p className="text-meta text-muted-foreground">You have no tickets yet.</p>
  }

  return (
    <div className="space-y-4">
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
          {data.items.map((ticket) => (
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

      {data.total > data.pageSize ? (
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
              onClick={() => setPage((prev) => prev - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
