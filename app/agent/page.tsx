import { auth } from "@/auth"

import { DashboardOverview } from "@/components/agent/dashboard/dashboard-overview"

export default async function AgentDashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-display">Agent dashboard</h1>
        <p className="text-meta text-muted-foreground">
          Signed in as {session?.user.name} ({session?.user.role}).
        </p>
      </div>
      <DashboardOverview />
    </div>
  )
}
