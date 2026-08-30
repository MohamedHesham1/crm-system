"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from "@/lib/validation/ticket"

export function TicketBreakdownCharts({
  byStatus,
  byPriority,
}: {
  byStatus: Record<TicketStatus, number>
  byPriority: Record<TicketPriority, number>
}) {
  const statusData = TICKET_STATUSES.map((status) => ({ label: status, count: byStatus[status] }))
  const priorityData = TICKET_PRIORITIES.map((priority) => ({
    label: priority,
    count: byPriority[priority],
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tickets by status</CardTitle>
        </CardHeader>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: "0.8125rem",
              }}
            />
            <Bar dataKey="count" fill="var(--chart-1)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets by priority</CardTitle>
        </CardHeader>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={priorityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: "0.8125rem",
              }}
            />
            <Bar dataKey="count" fill="var(--chart-2)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
