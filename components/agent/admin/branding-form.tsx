"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { BrandLogo } from "@/components/brand/brand-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import {
  brandingKeys,
  fetchBrandingSettings,
  removeBrandLogo,
  updateBrandingSettings,
  uploadBrandLogo,
} from "@/lib/branding-client"
import type { BrandingSettingsView } from "@/lib/branding-client"
import { foregroundForBrandColor } from "@/lib/validation/branding"

const COLOR_FIELDS = [
  { name: "primaryLight", label: "Light theme primary" },
  { name: "primaryDark", label: "Dark theme primary" },
  { name: "accentLight", label: "Light theme accent" },
  { name: "accentDark", label: "Dark theme accent" },
] as const

type BrandingChanges = {
  organizationName: string
  primaryLight: string
  primaryDark: string
  accentLight: string
  accentDark: string
}

export function BrandingForm() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const queryKey = brandingKeys.settings()
  const query = useQuery({ queryKey, queryFn: fetchBrandingSettings })
  const [logoError, setLogoError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BrandingChanges | null>(null)
  const settingsMutation = useMutation({
    mutationFn: updateBrandingSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKey, settings)
      setDraft({
        organizationName: settings.organizationName,
        primaryLight: settings.primaryLight,
        primaryDark: settings.primaryDark,
        accentLight: settings.accentLight,
        accentDark: settings.accentDark,
      })
      router.refresh()
    },
  })
  const logoMutation = useMutation({
    mutationFn: uploadBrandLogo,
    onSuccess: (settings) => {
      setLogoError(null)
      queryClient.setQueryData(queryKey, settings)
      router.refresh()
    },
  })
  const removeMutation = useMutation({
    mutationFn: removeBrandLogo,
    onSuccess: (settings) => {
      setLogoError(null)
      queryClient.setQueryData(queryKey, settings)
      router.refresh()
    },
  })

  if (query.isPending) return <Spinner label="Loading branding settings…" />
  if (query.isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {query.error instanceof Error ? query.error.message : "Could not load branding settings."}
      </p>
    )
  }

  const settings = query.data
  const values = draft ?? {
    organizationName: settings.organizationName,
    primaryLight: settings.primaryLight,
    primaryDark: settings.primaryDark,
    accentLight: settings.accentLight,
    accentDark: settings.accentDark,
  }
  const errors =
    settingsMutation.error instanceof ApiError ? settingsMutation.error.fieldErrors : {}
  const formError =
    settingsMutation.error instanceof Error
      ? settingsMutation.error.message
      : logoMutation.error instanceof Error
        ? logoMutation.error.message
        : removeMutation.error instanceof Error
          ? removeMutation.error.message
          : null
  const locked = settingsMutation.isPending || logoMutation.isPending || removeMutation.isPending

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    settingsMutation.mutate({
      organizationName: String(data.get("organizationName") ?? ""),
      primaryLight: String(data.get("primaryLight") ?? ""),
      primaryDark: String(data.get("primaryDark") ?? ""),
      accentLight: String(data.get("accentLight") ?? ""),
      accentDark: String(data.get("accentDark") ?? ""),
    })
  }

  function submitLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = new FormData(event.currentTarget).get("logo")
    if (!(file instanceof File) || file.size === 0) {
      setLogoError("Choose a PNG, JPEG, or WebP image.")
      return
    }
    logoMutation.mutate(file)
  }

  return (
    <div className="space-y-6">
      {formError ? <p role="alert" className="text-meta text-destructive">{formError}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Organization identity</CardTitle>
          <CardDescription>
            Name and approved colors appear across staff, customer, and printed report screens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-5" onSubmit={submitSettings}>
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                value={values.organizationName}
                onChange={(event) => setDraft({ ...values, organizationName: event.currentTarget.value })}
                maxLength={80}
                required
                aria-invalid={Boolean(errors.organizationName)}
              />
              {errors.organizationName?.[0] ? (
                <p role="alert" className="text-meta text-destructive">{errors.organizationName[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map(({ name, label }) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name}>{label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id={name}
                      name={name}
                      type="color"
                      value={values[name]}
                      onChange={(event) => setDraft({ ...values, [name]: event.currentTarget.value })}
                      aria-label={label}
                      aria-invalid={Boolean(errors[name])}
                      className="size-10 cursor-pointer rounded border border-input bg-background p-1 focus-visible:outline-2 focus-visible:outline-ring"
                    />
                    <span className="font-mono text-meta text-muted-foreground">{values[name]}</span>
                  </div>
                  {errors[name]?.[0] ? (
                    <p role="alert" className="text-meta text-destructive">{errors[name][0]}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <p className="text-meta text-muted-foreground">
              Text color adjusts automatically. Each selected color must meet WCAG AA contrast in its theme.
            </p>
            <Button type="submit" disabled={locked}>Save branding</Button>
          </form>
        </CardContent>
      </Card>

      <LogoCard settings={{ ...settings, organizationName: values.organizationName }} disabled={locked} error={logoError} onUpload={submitLogo}
        onRemove={() => removeMutation.mutate()} />
      <ThemePreviews settings={{
        ...settings,
        organizationName: values.organizationName,
        primaryLight: values.primaryLight,
        primaryDark: values.primaryDark,
        accentLight: values.accentLight,
        accentDark: values.accentDark,
      }} />
    </div>
  )
}

function LogoCard({
  settings,
  disabled,
  error,
  onUpload,
  onRemove,
}: {
  settings: BrandingSettingsView
  disabled: boolean
  error: string | null
  onUpload: (event: FormEvent<HTMLFormElement>) => void
  onRemove: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization logo</CardTitle>
        <CardDescription>PNG, JPEG, or WebP; maximum 2 MiB. Stored on this installation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border p-4">
          <BrandLogo
            key={settings.logoAttachmentId ?? "no-logo"}
            logoUrl={settings.logoAvailable ? settings.logoUrl : null}
          />
          <div>
            <p className="font-medium">{settings.organizationName}</p>
            {settings.logoAttachmentId && !settings.logoAvailable ? (
              <p role="alert" className="text-meta text-destructive">
                Logo file is missing. Upload a replacement or remove the saved logo.
              </p>
            ) : (
              <p className="text-meta text-muted-foreground">
                {settings.logoAttachmentId ? "Current logo" : "Using the built-in mark"}
              </p>
            )}
          </div>
        </div>
        {error ? <p role="alert" className="text-meta text-destructive">{error}</p> : null}
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onUpload}>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="brand-logo-file">Upload a logo</Label>
            <Input
              id="brand-logo-file"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled}
              onChange={() => undefined}
            />
          </div>
          <Button type="submit" variant="outline" disabled={disabled}>Upload logo</Button>
          {settings.logoAttachmentId ? (
            <Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}>
              Remove logo
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

function ThemePreviews({ settings }: { settings: BrandingSettingsView }) {
  const themes = [
    { label: "Light theme", primary: settings.primaryLight, accent: settings.accentLight },
    { label: "Dark theme", primary: settings.primaryDark, accent: settings.accentDark },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Color preview</CardTitle>
        <CardDescription>Preview applies on the next page load and respects each person’s theme.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {themes.map(({ label, primary, accent }) => (
          <div key={label} className="space-y-3 rounded-md border p-4">
            <p className="text-meta font-medium">{label}</p>
            <div className="flex items-center gap-3">
              <span
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: primary, color: foregroundForBrandColor(primary) }}
              >
                Primary action
              </span>
              <span
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: accent, color: foregroundForBrandColor(accent) }}
              >
                Accent
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
