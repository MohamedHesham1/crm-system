"use client"

import { useQuery } from "@tanstack/react-query"

import { AssignedTicketList } from "@/components/agent/dashboard/assigned-ticket-list"
import { SummaryCards } from "@/components/agent/dashboard/summary-cards"
import { Spinner } from "@/components/ui/spinner"
import { dashboardKeys, fetchDashboardSummary } from "@/lib/dashboard"

export function DashboardOverview() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: fetchDashboardSummary,
    // The provider-wide `staleTime: 30_000` (`app/providers.tsx:12`) would serve
    // a cached summary for half a minute after the agent claims a ticket on
    // `/agent/tickets` and navigates back. Counts are the one thing on this page
    // that must not be stale on arrival. No `refetchInterval` — the dashboard is
    // not a live monitor, and the only 30 s poller in this app is the bell
    // (`components/agent/notification-bell.tsx:27`).
    staleTime: 0,
  })

  return (
    <div className="space-y-6">
      {isPending ? <Spinner label="Loading dashboard…" /> : null}

      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load the dashboard."}
        </p>
      ) : null}

      {!isPending && !isError ? (
        <>
          <SummaryCards summary={data} />
          <h2 className="text-title">Assigned to me</h2>
          <AssignedTicketList tickets={data.tickets} />
        </>
      ) : null}
    </div>
  )
}
