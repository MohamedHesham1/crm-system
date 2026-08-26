import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { SidebarNav } from "@/components/agent/sidebar-nav"
import { SignOutButton } from "@/components/sign-out-button"

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "AGENT") redirect("/portal")

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30 p-4">
        <div className="mb-6 px-3 text-lg font-semibold">CRM</div>
        <SidebarNav />
        <div className="mt-auto border-t pt-4">
          <p className="px-3 pb-2 text-sm text-muted-foreground">{session.user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
