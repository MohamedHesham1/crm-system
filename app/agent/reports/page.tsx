import { auth } from "@/auth"

import { ReportsOverview } from "@/components/agent/reports/reports-overview"

export default async function ReportsPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <h1 className="text-display">Reports</h1>
      {/* Cosmetic only. The real gate is `requireAdmin()` in
          `app/api/reports/agents/route.ts` — an AGENT who forces this prop true
          in devtools still gets a 403 from the endpoint. */}
      <ReportsOverview isAdmin={session?.user.role === "ADMIN"} />
    </div>
  )
}
