import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand/brand-logo"

/**
 * Placeholder branding, not a designed logo: a geometric mark in the brand
 * colour plus the name in the heading face. Both come from tokens, so the
 * wordmark inverts with the theme like everything else.
 */
export function Wordmark({
  href,
  showProduct = false,
  className,
  name = BRAND.name,
  logoAttachmentId = null,
}: {
  href: string
  showProduct?: boolean
  className?: string
  name?: string
  logoAttachmentId?: string | null
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <BrandLogo
        key={logoAttachmentId ?? "default"}
        logoUrl={logoAttachmentId ? "/api/branding/logo" : null}
      />
      <span className="max-w-full truncate font-heading text-title leading-none">
        {name}
        {showProduct ? (
          <span className="ml-1.5 text-meta font-normal text-muted-foreground">
            {BRAND.product}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
