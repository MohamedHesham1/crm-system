import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchCommentsMock, postCommentMock, fetchStaffMock } = vi.hoisted(() => ({
  fetchCommentsMock: vi.fn(),
  postCommentMock: vi.fn(),
  fetchStaffMock: vi.fn(),
}))

vi.mock("@/lib/tickets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tickets")>()
  return {
    ...actual,
    fetchComments: fetchCommentsMock,
    postComment: postCommentMock,
  }
})
vi.mock("@/lib/users", () => ({
  userKeys: { staff: () => ["users", "staff"] },
  fetchStaff: fetchStaffMock,
}))

import { CommentThread } from "@/components/agent/tickets/comment-thread"

const comments = [
  {
    id: "public",
    body: "Public comment",
    isInternal: false,
    createdAt: new Date().toISOString(),
    author: { id: "agent", name: "Agent", role: "AGENT" as const },
  },
  {
    id: "internal",
    body: "Staff-only note",
    isInternal: true,
    createdAt: new Date().toISOString(),
    author: { id: "agent", name: "Agent", role: "AGENT" as const },
  },
]

describe("CommentThread", () => {
  it("appends quick replies to drafts without posting or changing visibility", async () => {
    const user = userEvent.setup()
    fetchCommentsMock.mockResolvedValue(comments)
    fetchStaffMock.mockResolvedValue([])
    postCommentMock.mockResolvedValue(undefined)

    renderWithQuery(<CommentThread ticketId="ticket-1" canWriteInternalNotes />)

    expect(await screen.findByText("Staff-only note")).toBeInTheDocument()
    const draft = await screen.findByRole("textbox", { name: "" })
    await user.type(draft, "Existing draft")
    await user.click(screen.getByRole("button", { name: "Internal note" }))
    await user.click(screen.getByRole("combobox", { name: "Quick replies" }))
    await user.click(await screen.findByRole("option", { name: "Ask for more details" }))

    expect(draft).toHaveValue(
      "Existing draft\nCould you share a few more details so we can investigate?",
    )
    expect(screen.getByRole("button", { name: "Internal note" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(postCommentMock).not.toHaveBeenCalled()
  })

  it("hides staff-only controls and internal notes without staff capability", async () => {
    fetchCommentsMock.mockResolvedValue(comments)
    fetchStaffMock.mockResolvedValue([])

    renderWithQuery(<CommentThread ticketId="ticket-1" canWriteInternalNotes={false} />)

    expect(await screen.findByText("Public comment")).toBeInTheDocument()
    expect(screen.queryByText("Staff-only note")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Internal note" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Quick replies" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Mention staff" })).not.toBeInTheDocument()
  })

  it("submits staff internal notes with internal visibility", async () => {
    const user = userEvent.setup()
    fetchCommentsMock.mockResolvedValue([])
    fetchStaffMock.mockResolvedValue([])
    postCommentMock.mockResolvedValue(undefined)

    renderWithQuery(<CommentThread ticketId="ticket-1" canWriteInternalNotes />)

    await user.type(await screen.findByRole("textbox", { name: "" }), "Private investigation")
    await user.click(screen.getByRole("button", { name: "Internal note" }))
    await user.click(screen.getByRole("button", { name: "Add internal note" }))

    await waitFor(() => expect(postCommentMock).toHaveBeenCalledWith("ticket-1", {
      body: "Private investigation",
      isInternal: true,
      mentionedUserIds: [],
    }))
  })

  it("submits selected staff mentions", async () => {
    const user = userEvent.setup()
    fetchCommentsMock.mockResolvedValue([])
    fetchStaffMock.mockResolvedValue([{ id: "staff-1", name: "Sam Staff", role: "AGENT" }])
    postCommentMock.mockResolvedValue(undefined)

    renderWithQuery(<CommentThread ticketId="ticket-1" canWriteInternalNotes />)

    await user.type(await screen.findByRole("textbox", { name: "" }), "Please review")
    await user.click(await screen.findByRole("checkbox", { name: "Sam Staff" }))
    await user.click(screen.getByRole("button", { name: "Post comment" }))

    await waitFor(() =>
      expect(postCommentMock).toHaveBeenCalledWith("ticket-1", {
        body: "Please review",
        isInternal: false,
        mentionedUserIds: ["staff-1"],
      }),
    )
  })
})
