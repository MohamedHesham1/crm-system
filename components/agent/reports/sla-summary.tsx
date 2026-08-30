import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { formatDuration, type SlaSummary } from "@/lib/report-metrics"
import type { TicketStatus } from "@/lib/validation/ticket"

export function SlaSummaryCards({
  sla,
  terminalStatuses,
}: {
  sla: SlaSummary
  terminalStatuses: readonly TicketStatus[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card size="sm">
        <CardHeader>
          <CardDescription>On-time resolution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <span className="text-2xl font-semibold">
            {sla.onTimeRate === null ? "—" : `${Math.round(sla.onTimeRate * 100)}%`}
          </span>
          <p className="text-xs text-muted-foreground">
            {sla.onTime} of {sla.measured} tickets with an SLA target
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardDescription>Average resolution time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <span className="text-2xl font-semibold">{formatDuration(sla.averageResolutionMs)}</span>
          <p className="text-xs text-muted-foreground">across {sla.resolved} resolved tickets</p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardDescription>Resolved</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <span className="text-2xl font-semibold">{sla.resolved}</span>
          <p className="text-xs text-muted-foreground">
            {terminalStatuses.join(" or ").toLowerCase()} tickets
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
