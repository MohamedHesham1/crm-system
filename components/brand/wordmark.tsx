import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * Placeholder branding, not a designed logo: a geometric mark in the brand
 * colour plus the name in the heading face. Both come from tokens, so the
 * wordmark inverts with the theme like everything else.
 */
export function Wordmark({
  href,
  showProduct = false,
  className,
}: {
  href: string
  showProduct?: boolean
  className?: string
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="size-5 shrink-0 text-brand"
      >
        <rect x="1" y="1" width="18" height="18" rx="5" fill="currentColor" opacity="0.16" />
        <path
          d="M5 13.5 L10 5 L15 13.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-heading text-title leading-none">
        {BRAND.name}
        {showProduct ? (
          <span className="ml-1.5 text-meta font-normal text-muted-foreground">
            {BRAND.product}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
