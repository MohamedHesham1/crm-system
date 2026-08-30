import Link from "next/link"

import { Button } from "@/components/ui/button"
import { TicketTable } from "@/components/agent/tickets/ticket-table"

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display">Tickets</h1>
        <Button asChild size="sm">
          <Link href="/agent/tickets/new">New ticket</Link>
        </Button>
      </div>
      <TicketTable />
    </div>
  )
}
