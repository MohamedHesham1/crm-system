import { z } from "zod"

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.")

const brandingShape = {
  organizationName: z.string().trim().min(1, "Organization name is required.").max(80),
  primaryLight: hexColorSchema,
  primaryDark: hexColorSchema,
  accentLight: hexColorSchema,
  accentDark: hexColorSchema,
}

export const updateBrandingSchema = z.object(brandingShape).partial().refine(
  (input) => Object.keys(input).length > 0,
  "Provide at least one branding setting to update.",
)

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>

function luminance(hexColor: string): number {
  const channels = hexColor.slice(1).match(/.{2}/g)
  if (!channels) return 0
  const linear = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrastRatio(first: number, second: number): number {
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

export function foregroundForBrandColor(hexColor: string): "#ffffff" | "#17212b" {
  const colorLuminance = luminance(hexColor)
  const whiteContrast = contrastRatio(1, colorLuminance)
  const darkContrast = contrastRatio(luminance("#17212b"), colorLuminance)
  return whiteContrast >= darkContrast ? "#ffffff" : "#17212b"
}

export function brandColorContrast(hexColor: string): number {
  const colorLuminance = luminance(hexColor)
  return Math.max(
    contrastRatio(1, colorLuminance),
    contrastRatio(luminance("#17212b"), colorLuminance),
  )
}

export function validateBrandingContrast(input: Record<string, unknown>) {
  const errors: Record<string, string[]> = {}
  for (const field of ["primaryLight", "primaryDark", "accentLight", "accentDark"] as const) {
    const color = input[field]
    if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) && brandColorContrast(color) < 4.5) {
      errors[field] = ["Choose a color that provides at least 4.5:1 contrast with its text."]
    }
  }
  return errors
}

export const MAX_BRAND_LOGO_SIZE = 2 * 1024 * 1024
export const BRAND_LOGO_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const

export function isBrandLogoFile(file: File): boolean {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
  return (
    file.size > 0 &&
    file.size <= MAX_BRAND_LOGO_SIZE &&
    (extension === ".png" || extension === ".jpg" || extension === ".jpeg" || extension === ".webp")
  )
}
