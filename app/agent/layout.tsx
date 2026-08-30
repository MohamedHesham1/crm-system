import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { isStaff } from "@/lib/roles"
import { SidebarNav } from "@/components/agent/sidebar-nav"
import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/brand/wordmark"

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (!isStaff(session.user.role)) redirect("/portal")

  return (
    <div className="flex min-h-screen bg-surface-sunken">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
        <Wordmark href="/agent" className="px-2 pt-1" />
        <SidebarNav role={session.user.role} />
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <p className="px-2 text-meta text-muted-foreground">{session.user.email}</p>
          <div className="flex items-center justify-between px-1">
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  )
}
