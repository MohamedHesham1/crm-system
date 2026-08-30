import { request } from "@/lib/api/client"
import type { SlaSummary } from "@/lib/report-metrics"
import type { TicketPriority, TicketStatus } from "@/lib/validation/ticket"

export type ReportSummary = {
  tickets: {
    total: number
    byStatus: Record<TicketStatus, number>
    byPriority: Record<TicketPriority, number>
  }
  sla: SlaSummary
  csat: {
    /** `null` when no feedback exists — render "No ratings yet", not "0.0". */
    average: number | null
    count: number
    distribution: Record<number, number>
  }
  terminalStatuses: readonly TicketStatus[]
}

export type AgentPerformance = {
  agentId: string | null
  name: string
  resolved: number
  averageResolutionMs: number | null
  onTime: number
  measured: number
}

export const reportKeys = {
  all: ["reports"] as const,
  summary: () => [...reportKeys.all, "summary"] as const,
  agents: () => [...reportKeys.all, "agents"] as const,
}

export async function fetchReportSummary(): Promise<ReportSummary> {
  return request<ReportSummary>("/api/reports")
}

export async function fetchAgentPerformance(): Promise<AgentPerformance[]> {
  const { agents } = await request<{ agents: AgentPerformance[] }>("/api/reports/agents")
  return agents
}
