import { request } from "@/lib/api/client"
import type { BrandSettings } from "@/lib/branding"

export type BrandingSettingsView = BrandSettings & {
  logoUrl: string | null
  logoAvailable: boolean
}

export const brandingKeys = {
  all: ["branding"] as const,
  settings: () => [...brandingKeys.all, "settings"] as const,
}

export async function fetchBrandingSettings(): Promise<BrandingSettingsView> {
  return request<BrandingSettingsView>("/api/admin/branding")
}

export async function updateBrandingSettings(
  changes: Partial<Omit<BrandSettings, "id" | "logoAttachmentId">>,
): Promise<BrandingSettingsView> {
  return request<BrandingSettingsView>("/api/admin/branding", {
    method: "PATCH",
    body: JSON.stringify(changes),
  })
}

export async function uploadBrandLogo(file: File): Promise<BrandingSettingsView> {
  const formData = new FormData()
  formData.set("file", file)
  return request<BrandingSettingsView>("/api/admin/branding", {
    method: "POST",
    body: formData,
  })
}

export async function removeBrandLogo(): Promise<BrandingSettingsView> {
  return request<BrandingSettingsView>("/api/admin/branding", { method: "DELETE" })
}
