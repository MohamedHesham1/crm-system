import { getActiveTicketCategories } from "@/lib/settings"
import { withAuth } from "@/lib/api/http"

export const GET = withAuth({ role: "viewer" }, async () => {
  return Response.json({ categories: await getActiveTicketCategories() })
})
