import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { TopNav } from "@/components/portal/top-nav"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "CUSTOMER") redirect("/agent")

  return (
    <div className="min-h-screen">
      <TopNav email={session.user.email ?? ""} />
      <main className="mx-auto max-w-4xl p-8">{children}</main>
    </div>
  )
}
