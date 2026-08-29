import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  // `app/agent/layout.tsx` already established there is a signed-in staff user;
  // this narrows the agent area to ADMIN. Non-admins are redirected, not 403'd.
  if (session?.user.role !== "ADMIN") redirect("/agent")

  return children
}
