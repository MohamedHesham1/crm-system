import { cache } from "react"
import type { CSSProperties } from "react"

import { BRAND } from "@/lib/brand"
import { prisma } from "@/lib/prisma"
import { foregroundForBrandColor } from "@/lib/validation/branding"

export const BRAND_SETTINGS_ID = "installation"
export const BRAND_PRODUCT = "Service Desk"

export const DEFAULT_BRANDING = {
  id: BRAND_SETTINGS_ID,
  organizationName: BRAND.name,
  primaryLight: "#086071",
  primaryDark: "#61bcc6",
  accentLight: "#e08829",
  accentDark: "#f1ab4a",
  logoAttachmentId: null as string | null,
}

export type BrandSettings = {
  id: string
  organizationName: string
  primaryLight: string
  primaryDark: string
  accentLight: string
  accentDark: string
  logoAttachmentId: string | null
}

export const getBrandSettings = cache(async (): Promise<BrandSettings> => {
  const stored = await prisma.brandingSettings.findUnique({
    where: { id: BRAND_SETTINGS_ID },
    select: {
      id: true,
      organizationName: true,
      primaryLight: true,
      primaryDark: true,
      accentLight: true,
      accentDark: true,
      logoAttachmentId: true,
    },
  })
  return stored ?? DEFAULT_BRANDING
})

export function brandCssVariables(settings: BrandSettings): CSSProperties {
  return {
    "--configured-primary-light": settings.primaryLight,
    "--configured-primary-dark": settings.primaryDark,
    "--configured-primary-light-foreground": foregroundForBrandColor(settings.primaryLight),
    "--configured-primary-dark-foreground": foregroundForBrandColor(settings.primaryDark),
    "--configured-accent-light": settings.accentLight,
    "--configured-accent-dark": settings.accentDark,
    "--configured-accent-light-foreground": foregroundForBrandColor(settings.accentLight),
    "--configured-accent-dark-foreground": foregroundForBrandColor(settings.accentDark),
  } as CSSProperties
}

export function brandingResponse(settings: BrandSettings, logoAvailable = true) {
  return {
    ...settings,
    logoUrl: settings.logoAttachmentId ? "/api/branding/logo" : null,
    logoAvailable: settings.logoAttachmentId === null || logoAvailable,
  }
}

export type BrandWordmarkSettings = Pick<BrandSettings, "organizationName" | "logoAttachmentId">
