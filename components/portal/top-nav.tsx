import Link from "next/link"

import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/brand/wordmark"

export function TopNav({ email }: { email: string }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Wordmark href="/portal" showProduct />
        <div className="flex items-center gap-4">
          <Link href="/portal/tickets" className="text-meta text-muted-foreground hover:text-foreground">
            My tickets
          </Link>
          <Link href="/portal/faq" className="text-meta text-muted-foreground hover:text-foreground">
            FAQ
          </Link>
          <span className="text-meta text-muted-foreground">{email}</span>
          <SignOutButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
