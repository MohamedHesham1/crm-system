import type { ReactNode } from "react"

import { Wordmark } from "@/components/brand/wordmark"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-sunken p-4">
      <Wordmark href="/login" showProduct />
      {children}
    </main>
  )
}
