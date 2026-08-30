import { describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchTicketMock, updateTicketMock, useSessionMock, fetchCommentsMock } = vi.hoisted(() => ({
  fetchTicketMock: vi.fn(),
  updateTicketMock: vi.fn(),
  useSessionMock: vi.fn(),
  fetchCommentsMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }))
vi.mock("@/lib/tickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tickets")>()
  return {
    ...actual,
    fetchTicket: fetchTicketMock,
    updateTicket: updateTicketMock,
    fetchComments: fetchCommentsMock,
  }
})

import { TicketDetail } from "@/components/agent/tickets/ticket-detail"

const BASE_TICKET = {
  id: "t1",
  subject: "Cannot log in",
  category: "Account",
  priority: "MEDIUM" as const,
  dueAt: null,
  createdAt: new Date().toISOString(),
  slaBreached: false,
  customer: { id: "c1", name: "Nadia", email: "nadia@northwind.example", company: null },
  description: "Password reset link is broken.",
  comments: [],
  feedback: null,
}

describe("TicketDetail status control", () => {
  it("changes status through the select and locks the control when closed", async () => {
    const user = userEvent.setup()
    useSessionMock.mockReturnValue({ data: { user: { id: "agent-1", name: "Ava", role: "AGENT" } } })
    fetchCommentsMock.mockResolvedValue([])
    fetchTicketMock.mockResolvedValue({ ...BASE_TICKET, status: "OPEN", assignedAgent: null })

    renderWithQuery(<TicketDetail ticketId="t1" />)
    await screen.findByText("Cannot log in")

    await user.click(screen.getAllByRole("combobox")[0])
    await user.click(await screen.findByRole("option", { name: "RESOLVED" }))

    await waitFor(() => {
      expect(updateTicketMock).toHaveBeenCalledWith("t1", { status: "RESOLVED" })
    })

    cleanup()
    fetchTicketMock.mockResolvedValue({ ...BASE_TICKET, status: "CLOSED", assignedAgent: null })
    renderWithQuery(<TicketDetail ticketId="t1" />)
    await screen.findByText("Cannot log in")

    const comboboxes = screen.getAllByRole("combobox")
    expect(comboboxes[0]).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reopen ticket" })).toBeInTheDocument()
  })
})
