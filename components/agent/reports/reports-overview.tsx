"use client"

import { useQuery } from "@tanstack/react-query"

import { AgentPerformanceTable } from "@/components/agent/reports/agent-performance-table"
import { CsatSummary } from "@/components/agent/reports/csat-summary"
import { SlaSummaryCards } from "@/components/agent/reports/sla-summary"
import { TicketBreakdownCharts } from "@/components/agent/reports/ticket-breakdown-charts"
import { fetchReportSummary, reportKeys } from "@/lib/reports"

export function ReportsOverview({ isAdmin }: { isAdmin: boolean }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: reportKeys.summary(),
    queryFn: fetchReportSummary,
    // Same reasoning as `dashboard-overview.tsx:13–19`: the provider default
    // (`app/providers.tsx:12`) would serve half-minute-old numbers to someone
    // who just resolved a ticket. No `refetchInterval` — this is a report, not
    // a monitor.
    staleTime: 0,
  })

  return (
    <div className="space-y-6">
      {isPending ? <p className="text-meta text-muted-foreground">Loading reports…</p> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load reports."}
        </p>
      ) : null}

      {!isPending && !isError ? (
        <>
          <TicketBreakdownCharts byStatus={data.tickets.byStatus} byPriority={data.tickets.byPriority} />
          <SlaSummaryCards sla={data.sla} terminalStatuses={data.terminalStatuses} />
          <CsatSummary csat={data.csat} />
          {isAdmin ? <AgentPerformanceTable /> : null}
        </>
      ) : null}
    </div>
  )
}
