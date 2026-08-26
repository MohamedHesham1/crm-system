import { auth } from "@/auth"

export default async function AgentDashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Agent dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as {session?.user.name} ({session?.user.role}).
      </p>
    </div>
  )
}
