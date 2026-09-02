"use client"

import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MenuIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/brand/wordmark"

const SIDEBAR_ID = "agent-sidebar"

/**
 * Below `md:` the aside is a `fixed` off-canvas drawer moved by a transform,
 * **not** conditionally rendered — a `display:none` sibling has nothing for
 * `transition-transform` to animate, so it would pop instead of slide. At
 * `md:` and above `md:static md:translate-x-0` puts it back in the flex row
 * of `app/agent/layout.tsx:18` and the toggle and backdrop are `md:hidden`,
 * making desktop byte-for-byte what it was before this component existed.
 *
 * Children are passed in rather than imported: `SignOutButton` is a server
 * component with an inline `"use server"` action and cannot cross into a
 * client module.
 */
export function SidebarShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [prevPathname, setPrevPathname] = useState(pathname)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  function handleNavClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false)
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls={SIDEBAR_ID}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XIcon /> : <MenuIcon />}
        </Button>
        <Wordmark href="/agent" />
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
        />
      ) : null}

      <aside
        id={SIDEBAR_ID}
        onClick={handleNavClick}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </aside>
    </>
  )
}
