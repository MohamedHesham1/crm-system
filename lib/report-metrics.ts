/** One resolved ticket, as selected by `app/api/reports/route.ts`. */
export type ResolvedTicketRow = {
  createdAt: Date
  resolvedAt: Date
  dueAt: Date | null
  assignedAgentId: string | null
}

export type SlaSummary = {
  /** Resolved tickets that had a `dueAt` to be measured against. */
  measured: number
  /** Of those, the ones finished at or before `dueAt`. */
  onTime: number
  /** `onTime / measured`, or `null` when nothing is measurable. **Not zero** — "no data" and "0%" are different answers. */
  onTimeRate: number | null
  /** Mean `resolvedAt - createdAt` in milliseconds across **all** resolved tickets, `dueAt` or not. `null` when there are none. */
  averageResolutionMs: number | null
  /** Total resolved tickets — the denominator of `averageResolutionMs`. */
  resolved: number
}

export function summariseSla(rows: ResolvedTicketRow[]): SlaSummary {
  const measurable = rows.filter((row) => row.dueAt !== null)
  const onTime = measurable.filter((row) => row.resolvedAt.getTime() <= row.dueAt!.getTime()).length

  return {
    measured: measurable.length,
    onTime,
    onTimeRate: measurable.length === 0 ? null : onTime / measurable.length,
    averageResolutionMs: averageResolutionMs(rows),
    resolved: rows.length,
  }
}

export type AgentPerformanceRow = {
  agentId: string | null
  resolved: number
  averageResolutionMs: number | null
  onTime: number
  measured: number
}

/**
 * Groups the same rows by `assignedAgentId`. **`null` is a real bucket** — a
 * ticket resolved while unassigned is not dropped, because dropping it would
 * make the per-agent counts fail to sum to the total and nobody would know why.
 * The caller maps ids to names and labels `null` as "Unassigned".
 */
export function summariseAgents(rows: ResolvedTicketRow[]): AgentPerformanceRow[] {
  const buckets = new Map<string | null, ResolvedTicketRow[]>()

  for (const row of rows) {
    const existing = buckets.get(row.assignedAgentId)
    if (existing) existing.push(row)
    else buckets.set(row.assignedAgentId, [row])
  }

  return [...buckets].map(([agentId, group]) => {
    const measurable = group.filter((row) => row.dueAt !== null)
    return {
      agentId,
      resolved: group.length,
      averageResolutionMs: averageResolutionMs(group),
      onTime: measurable.filter((row) => row.resolvedAt.getTime() <= row.dueAt!.getTime()).length,
      measured: measurable.length,
    }
  })
}

function averageResolutionMs(rows: ResolvedTicketRow[]): number | null {
  if (rows.length === 0) return null
  const total = rows.reduce(
    (sum, row) => sum + (row.resolvedAt.getTime() - row.createdAt.getTime()),
    0,
  )
  return total / rows.length
}

/** "2 d 4 h", "3 h 12 m", "48 m", or "—" for `null`. The one duration formatter. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—"
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${minutes % 60} m`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}
