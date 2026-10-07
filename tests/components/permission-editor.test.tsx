import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { fetchUserPermissionsMock, resetUserPermissionMock, setUserPermissionMock } = vi.hoisted(
  () => ({
    fetchUserPermissionsMock: vi.fn(),
    resetUserPermissionMock: vi.fn(),
    setUserPermissionMock: vi.fn(),
  }),
)

vi.mock("@/lib/permissions-client", () => ({
  fetchUserPermissions: fetchUserPermissionsMock,
  resetUserPermission: resetUserPermissionMock,
  setUserPermission: setUserPermissionMock,
  userPermissionKeys: {
    all: ["user-permissions"],
    detail: (id: string) => ["user-permissions", id],
  },
}))

import { PermissionEditor } from "@/components/agent/admin/permission-editor"
import { renderWithQuery } from "@/tests/helpers/render"

describe("permission editor", () => {
  it("displays effective grants, applies changes, and can reset them", async () => {
    const user = userEvent.setup()
    const settings = [
      {
        permission: "TICKETS_READ",
        label: "View tickets",
        defaultGranted: true,
        effectiveGranted: false,
        overridden: true,
      },
    ]
    fetchUserPermissionsMock.mockResolvedValue(settings)
    setUserPermissionMock.mockResolvedValue(settings)
    resetUserPermissionMock.mockResolvedValue(settings)
    renderWithQuery(<PermissionEditor userId="agent-1" />)

    await user.click(screen.getByRole("button", { name: "Manage permissions" }))
    const checkbox = await screen.findByRole("checkbox", { name: "View tickets" })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    await waitFor(() =>
      expect(setUserPermissionMock).toHaveBeenCalledWith("agent-1", {
        permission: "TICKETS_READ",
        granted: true,
      }),
    )

    await user.click(await screen.findByRole("button", { name: "Reset" }))
    await waitFor(() =>
      expect(resetUserPermissionMock).toHaveBeenCalledWith("agent-1", "TICKETS_READ"),
    )
  })

  it("shows API errors instead of hiding failed changes", async () => {
    const user = userEvent.setup()
    fetchUserPermissionsMock.mockResolvedValue([
      {
        permission: "TICKETS_READ",
        label: "View tickets",
        defaultGranted: true,
        effectiveGranted: true,
        overridden: false,
      },
    ])
    setUserPermissionMock.mockRejectedValue(new Error("Permission update failed"))
    renderWithQuery(<PermissionEditor userId="agent-2" />)

    await user.click(screen.getByRole("button", { name: "Manage permissions" }))
    await user.click(await screen.findByRole("checkbox", { name: "View tickets" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission update failed")
  })
})
