import type { ReactNode } from "react"
import { ClockAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * The one bold thing in the app. Amber (`--signal`) means "the clock ran
 * out" and appears nowhere else; red stays reserved for errors the operator
 * hit (the `role="alert"` paragraphs). Paired with the inset amber rail
 * defined in `app/globals.css`'s `@layer components` block, which fires off
 * `data-sla="breached"` on the row.
 *
 * **The rendered text must be the direct text content of this one span.**
 * `tests/components/assigned-ticket-list.test.tsx:37` asserts
 * `getAllByText("SLA breached")` has length 1; wrapping the children in an
 * inner element would make both that element and this one match, and the
 * test would fail with "found multiple elements".
 */
export function SlaBadge({
  children = "SLA breached",
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-signal/40 bg-signal-soft text-signal-foreground font-medium",
        className,
      )}
    >
      <ClockAlertIcon aria-hidden="true" />
      {children}
    </Badge>
  )
}
