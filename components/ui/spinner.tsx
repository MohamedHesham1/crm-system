import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted-foreground">
      <Loader2Icon aria-hidden="true" className={cn("size-4 animate-spin", className)} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
