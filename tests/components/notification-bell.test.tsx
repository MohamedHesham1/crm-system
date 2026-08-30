import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchNotificationsMock, markNotificationReadMock } = vi.hoisted(() => ({
  fetchNotificationsMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
}))

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notifications")>()
  return {
    ...actual,
    fetchNotifications: fetchNotificationsMock,
    markNotificationRead: markNotificationReadMock,
  }
})

import { NotificationBell } from "@/components/agent/notification-bell"

describe("NotificationBell", () => {
  it("drops the unread count after marking notifications read", async () => {
    const user = userEvent.setup()

    const unread = [
      { id: "n1", type: "TICKET_ASSIGNED" as const, message: "First", relatedTicketId: null, read: false, createdAt: new Date().toISOString() },
      { id: "n2", type: "TICKET_ASSIGNED" as const, message: "Second", relatedTicketId: null, read: false, createdAt: new Date().toISOString() },
    ]
    const read = unread.map((item) => ({ ...item, read: true }))

    fetchNotificationsMock
      .mockResolvedValueOnce({ notifications: unread, unreadCount: 2 })
      .mockResolvedValue({ notifications: read, unreadCount: 0 })
    markNotificationReadMock.mockResolvedValue(undefined)

    renderWithQuery(<NotificationBell />)

    await screen.findByText("2")
    await user.click(screen.getByRole("button", { name: /Notifications/ }))
    await user.click(await screen.findByRole("button", { name: "Mark all read" }))

    expect(markNotificationReadMock).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText("2")).not.toBeInTheDocument())
  })
})
