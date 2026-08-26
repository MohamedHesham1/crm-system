import Link from "next/link"

import { SignOutButton } from "@/components/sign-out-button"

export function TopNav({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/portal" className="text-lg font-semibold">
        CRM Portal
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{email}</span>
        <SignOutButton />
      </div>
    </header>
  )
}
