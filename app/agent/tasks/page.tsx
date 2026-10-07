import { auth } from "@/auth"

import { TaskList } from "@/components/agent/tasks/task-list"

export default async function AgentTasksPage() {
  const session = await auth()

  return (
    <div className="space-y-1">
      <h1 className="text-display">Tasks</h1>
      <p className="text-meta text-muted-foreground">Manage follow-ups and reminders.</p>
      <TaskList isAdmin={session?.user.role === "ADMIN"} />
    </div>
  )
}
