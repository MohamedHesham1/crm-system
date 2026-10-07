import type { ReactNode } from "react"
import { connection } from "next/server"

import { Wordmark } from "@/components/brand/wordmark"
import { getBrandSettings } from "@/lib/branding"

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await connection()
  const brand = await getBrandSettings()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-sunken p-4">
      <Wordmark
        href="/login"
        showProduct
        name={brand.organizationName}
        logoAttachmentId={brand.logoAttachmentId}
      />
      {children}
    </main>
  )
}
