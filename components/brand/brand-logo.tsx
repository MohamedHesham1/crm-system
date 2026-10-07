"use client"

import { useState } from "react"
import Image from "next/image"

export function BrandLogo({ logoUrl }: { logoUrl: string | null }) {
  const [showImage, setShowImage] = useState(Boolean(logoUrl))

  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-soft">
      {logoUrl && showImage ? (
        <Image
          src={logoUrl}
          alt=""
          width={28}
          height={28}
          unoptimized
          className="size-full object-contain"
          onError={() => setShowImage(false)}
        />
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 text-brand">
          <rect x="1" y="1" width="18" height="18" rx="5" fill="currentColor" opacity="0.16" />
          <path
            d="M5 13.5 L10 5 L15 13.5"
            fill="none"
            stroke="var(--brand-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
