import Link from "next/link"

import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/brand/wordmark"
import type { BrandWordmarkSettings } from "@/lib/branding"

export function TopNav({ email, brand }: { email: string; brand: BrandWordmarkSettings }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Wordmark
          href="/portal"
          showProduct
          name={brand.organizationName}
          logoAttachmentId={brand.logoAttachmentId}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
          <Link href="/portal/tickets" className="text-meta text-muted-foreground hover:text-foreground">
            My tickets
          </Link>
          <Link href="/portal/faq" className="text-meta text-muted-foreground hover:text-foreground">
            FAQ
          </Link>
          <Link href="/portal/knowledge-base" className="text-meta text-muted-foreground hover:text-foreground">
            Help articles
          </Link>
          <span className="hidden text-meta text-muted-foreground sm:inline">{email}</span>
          <SignOutButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
