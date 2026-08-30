"use client"

import { useQuery } from "@tanstack/react-query"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDuration } from "@/lib/report-metrics"
import { fetchAgentPerformance, reportKeys } from "@/lib/reports"

export function AgentPerformanceTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: reportKeys.agents(),
    queryFn: fetchAgentPerformance,
    staleTime: 0,
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading agent performance…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load agent performance."}
      </p>
    )
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No tickets have been resolved yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Resolved</TableHead>
          <TableHead>Avg. resolution</TableHead>
          <TableHead>On time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((agent) => (
          <TableRow key={agent.agentId ?? "unassigned"}>
            <TableCell className="font-medium">{agent.name}</TableCell>
            <TableCell>{agent.resolved}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDuration(agent.averageResolutionMs)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {agent.measured === 0 ? "—" : `${agent.onTime}/${agent.measured}`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
