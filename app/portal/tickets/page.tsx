import Link from "next/link"

import { Button } from "@/components/ui/button"
import { PortalTicketList } from "@/components/portal/tickets/portal-ticket-list"

export default function PortalTicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My tickets</h1>
        <Button asChild size="sm">
          <Link href="/portal/tickets/new">New ticket</Link>
        </Button>
      </div>
      <PortalTicketList />
    </div>
  )
}
