import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TaskItem } from "@/lib/tasks"

export function TaskOverview({
  upcoming,
  overdue,
}: {
  upcoming: TaskItem[]
  overdue: TaskItem[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Follow-up tasks</CardTitle>
        <Link href="/agent/tasks" className="text-meta underline underline-offset-2">
          Manage tasks
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdue.length === 0 && upcoming.length === 0 ? (
          <p className="text-meta text-muted-foreground">No open follow-up tasks.</p>
        ) : null}
        {overdue.map((task) => (
          <TaskRow key={task.id} task={task} overdue />
        ))}
        {upcoming.map((task) => (
          <TaskRow key={task.id} task={task} overdue={false} />
        ))}
      </CardContent>
    </Card>
  )
}

function TaskRow({ task, overdue }: { task: TaskItem; overdue: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <div className="min-w-0">
        <Link href="/agent/tasks" className="font-medium hover:underline">
          {task.title}
        </Link>
        <p className="text-label text-muted-foreground">
          {task.dueAt ? new Date(task.dueAt).toLocaleString() : "No due date"}
        </p>
      </div>
      {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
    </div>
  )
}
