import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { TicketStatus } from "@/lib/validation/ticket"
import type { VariantProps } from "class-variance-authority"

const STATUS_VARIANT: Record<TicketStatus, VariantProps<typeof badgeVariants>["variant"]> = {
  OPEN: "default",
  IN_PROGRESS: "outline",
  RESOLVED: "success",
  CLOSED: "secondary",
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
}
