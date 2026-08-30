import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SlaBadge } from "@/components/ui/sla-badge"
import type { DashboardSummary } from "@/lib/dashboard"
import { TICKET_STATUSES } from "@/lib/validation/ticket"

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TICKET_STATUSES.map((status) => (
        <Card key={status} size="sm">
          <CardHeader>
            <CardDescription>{status}</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-metric tabular-nums">{summary.assigned.byStatus[status]}</span>
          </CardContent>
        </Card>
      ))}

      <Card size="sm">
        <CardHeader>
          <CardTitle>Assigned to me</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-metric tabular-nums">{summary.assigned.total}</span>
          {summary.assigned.breached > 0 ? (
            <SlaBadge>{summary.assigned.breached} breached</SlaBadge>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Unassigned queue</CardTitle>
          <CardDescription>Waiting to be claimed</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-metric tabular-nums">{summary.queue.unassigned}</span>
          {summary.queue.breached > 0 ? (
            <SlaBadge>{summary.queue.breached} breached</SlaBadge>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/agent/tickets">Open the queue</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
