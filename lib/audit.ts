import { request } from "@/lib/api/client"
import type { AuditAction } from "@/lib/validation/notification"

export type AuditLogItem = {
  id: string
  entityType: string
  entityId: string
  action: AuditAction
  detail: string
  createdAt: string
  actor: { id: string; name: string; email: string }
}

export const auditKeys = {
  all: ["audit"] as const,
  list: (ticketId?: string) => [...auditKeys.all, "list", ticketId ?? null] as const,
}

export async function fetchAuditLogs(ticketId?: string): Promise<AuditLogItem[]> {
  const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : ""
  const { logs } = await request<{ logs: AuditLogItem[] }>(`/api/admin/audit${query}`)
  return logs
}
