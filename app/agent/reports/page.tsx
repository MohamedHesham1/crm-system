import { auth } from "@/auth"

import { ReportsOverview } from "@/components/agent/reports/reports-overview"
import { Wordmark } from "@/components/brand/wordmark"
import { getBrandSettings } from "@/lib/branding"

export default async function ReportsPage() {
  const [session, brand] = await Promise.all([auth(), getBrandSettings()])

  return (
    <div className="space-y-6">
      <div className="hidden print-only space-y-2">
        <Wordmark
          href="/agent/reports"
          showProduct
          name={brand.organizationName}
          logoAttachmentId={brand.logoAttachmentId}
        />
        <h1 className="text-display">Support performance report</h1>
      </div>
      <h1 className="print-hide text-display">Reports</h1>
      {/* Cosmetic only. The real gate is `requireAdmin()` in
          `app/api/reports/agents/route.ts` — an AGENT who forces this prop true
          in devtools still gets a 403 from the endpoint. */}
      <ReportsOverview isAdmin={session?.user.role === "ADMIN"} />
    </div>
  )
}
