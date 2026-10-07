import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { fetchBrandingSettingsMock, updateBrandingSettingsMock } = vi.hoisted(() => ({
  fetchBrandingSettingsMock: vi.fn(),
  updateBrandingSettingsMock: vi.fn(),
}))

vi.mock("@/lib/branding-client", () => ({
  brandingKeys: {
    all: ["branding"],
    settings: () => ["branding", "settings"],
  },
  fetchBrandingSettings: fetchBrandingSettingsMock,
  updateBrandingSettings: updateBrandingSettingsMock,
  uploadBrandLogo: vi.fn(),
  removeBrandLogo: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { BrandingForm } from "@/components/agent/admin/branding-form"
import { Wordmark } from "@/components/brand/wordmark"
import { renderWithQuery } from "@/tests/helpers/render"

const defaultSettings = {
  id: "installation",
  organizationName: "Meridian",
  primaryLight: "#086071",
  primaryDark: "#61bcc6",
  accentLight: "#e08829",
  accentDark: "#f1ab4a",
  logoAttachmentId: null,
  logoUrl: null,
  logoAvailable: true,
}

describe("installation branding editor", () => {
  it("renders the installation name through the shared navigation wordmark", () => {
    renderWithQuery(
      <Wordmark href="/portal" showProduct name="Northstar Support" logoAttachmentId={null} />,
    )
    expect(screen.getByRole("link")).toHaveTextContent("Northstar Support")
    expect(screen.getByRole("link")).toHaveTextContent("Service Desk")
  })

  it("edits installation identity and previews light and dark palettes", async () => {
    const user = userEvent.setup()
    fetchBrandingSettingsMock.mockResolvedValue(defaultSettings)
    updateBrandingSettingsMock.mockResolvedValue({
      ...defaultSettings,
      organizationName: "Northstar Support",
    })

    renderWithQuery(<BrandingForm />)
    const name = await screen.findByLabelText("Organization name")
    await user.clear(name)
    await user.type(name, "Northstar Support")
    await user.click(screen.getByRole("button", { name: "Save branding" }))

    await waitFor(() =>
      expect(updateBrandingSettingsMock.mock.calls[0]?.[0]).toMatchObject({
        organizationName: "Northstar Support",
      }),
    )
    expect(screen.getByText("Light theme")).toBeInTheDocument()
    expect(screen.getByText("Dark theme")).toBeInTheDocument()
    expect(screen.getByText("Using the built-in mark")).toBeInTheDocument()
  })

  it("shows saved-logo failures and surfaces rejected API requests", async () => {
    const user = userEvent.setup()
    fetchBrandingSettingsMock.mockResolvedValue({
      ...defaultSettings,
      logoAttachmentId: "missing-logo",
      logoUrl: "/api/branding/logo",
      logoAvailable: false,
    })
    updateBrandingSettingsMock.mockRejectedValue(new Error("Brand settings failed"))

    renderWithQuery(<BrandingForm />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Logo file is missing.")
    await user.click(screen.getByRole("button", { name: "Save branding" }))
    expect(await screen.findByText("Brand settings failed")).toBeInTheDocument()
  })
})
