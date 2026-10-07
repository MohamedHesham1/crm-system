import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const {
  fetchAdminTicketSettingsMock,
  createTicketCategoryMock,
  updateTicketCategoryMock,
  updateSlaTargetsMock,
} = vi.hoisted(() => ({
  fetchAdminTicketSettingsMock: vi.fn(),
  createTicketCategoryMock: vi.fn(),
  updateTicketCategoryMock: vi.fn(),
  updateSlaTargetsMock: vi.fn(),
}))

vi.mock("@/lib/settings", () => ({
  ticketSettingsKeys: {
    all: ["ticket-settings"],
    categories: () => ["ticket-categories"],
  },
  fetchAdminTicketSettings: fetchAdminTicketSettingsMock,
  createTicketCategory: createTicketCategoryMock,
  updateTicketCategory: updateTicketCategoryMock,
  updateSlaTargets: updateSlaTargetsMock,
}))

import { SettingsForm } from "@/components/agent/admin/settings-form"

describe("admin ticket settings", () => {
  it("adds, renames, deactivates categories, and saves response and resolution targets", async () => {
    const user = userEvent.setup()
    fetchAdminTicketSettingsMock.mockResolvedValue({
      categories: [
        {
          id: "billing",
          name: "Billing",
          normalizedName: "billing",
          active: true,
          sortOrder: 0,
        },
      ],
      slaTargets: [
        { priority: "LOW", responseHours: 72, resolutionHours: 72 },
        { priority: "MEDIUM", responseHours: 24, resolutionHours: 24 },
        { priority: "HIGH", responseHours: 4, resolutionHours: 4 },
      ],
    })
    createTicketCategoryMock.mockResolvedValue({})
    updateTicketCategoryMock.mockResolvedValue({})
    updateSlaTargetsMock.mockResolvedValue([])

    renderWithQuery(<SettingsForm />)

    await user.type(await screen.findByPlaceholderText("Add a category"), "Technical")
    await user.click(screen.getByRole("button", { name: "Add category" }))
    await waitFor(() =>
      expect(createTicketCategoryMock.mock.calls[0]?.[0]).toBe("Technical"),
    )

    await user.clear(screen.getByLabelText("Category name"))
    await user.type(screen.getByLabelText("Category name"), "Accounts")
    await user.click(screen.getByRole("button", { name: /^Save$/ }))
    await waitFor(() =>
      expect(updateTicketCategoryMock.mock.calls[0]?.[0]).toEqual({
        id: "billing",
        name: "Accounts",
        sortOrder: 0,
        active: true,
      }),
    )

    await user.click(screen.getByRole("button", { name: "Deactivate" }))
    await waitFor(() =>
      expect(updateTicketCategoryMock.mock.calls[1]?.[0]).toEqual({
        id: "billing",
        name: "Accounts",
        sortOrder: 0,
        active: false,
      }),
    )

    await user.clear(screen.getByRole("spinbutton", { name: "MEDIUM resolution target" }))
    await user.type(screen.getByRole("spinbutton", { name: "MEDIUM resolution target" }), "12")
    await user.click(screen.getByRole("button", { name: "Save SLA targets" }))
    await waitFor(() =>
      expect(updateSlaTargetsMock.mock.calls[0]?.[0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ priority: "MEDIUM", resolutionHours: 12, responseHours: 24 }),
        ]),
      ),
    )
  })
})
