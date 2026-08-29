"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { Role } from "@/lib/roles"
import { NotificationBell } from "@/components/agent/notification-bell"

const BASE_LINKS = [
  { href: "/agent", label: "Dashboard" },
  { href: "/agent/tickets", label: "Tickets" },
  { href: "/agent/customers", label: "Customers" },
] as const

const ADMIN_LINKS = [
  { href: "/agent/admin/users", label: "Admin" },
  { href: "/agent/admin/audit", label: "Audit" },
] as const

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const links = role === "ADMIN" ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS

  return (
    <div className="space-y-3">
      <NotificationBell />
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive =
            link.href === "/agent" ? pathname === "/agent" : pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
