import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchAttachmentsMock, uploadAttachmentMock, removeAttachmentMock } = vi.hoisted(() => ({
  fetchAttachmentsMock: vi.fn(),
  uploadAttachmentMock: vi.fn(),
  removeAttachmentMock: vi.fn(),
}))

vi.mock("@/lib/attachment-client", () => ({
  attachmentDownloadPath: (owner: { type: string; id: string }, id: string) =>
    `/api/${owner.type}s/${owner.id}/attachments/${id}`,
  fetchAttachments: fetchAttachmentsMock,
  uploadAttachment: uploadAttachmentMock,
  removeAttachment: removeAttachmentMock,
}))

import { AttachmentPanel } from "@/components/shared/attachment-panel"

describe("AttachmentPanel", () => {
  it("uploads a selected file and renders a private download link", async () => {
    const user = userEvent.setup()
    fetchAttachmentsMock.mockResolvedValue([
      {
        id: "attachment-1",
        originalName: "details.txt",
        contentType: "text/plain",
        size: 2048,
        createdAt: new Date().toISOString(),
        uploaderId: "agent-1",
        uploader: { id: "agent-1", name: "Agent" },
      },
    ])
    uploadAttachmentMock.mockResolvedValue({})

    renderWithQuery(
      <AttachmentPanel owner={{ type: "ticket", id: "ticket-1" }} allowDeleteAny />,
    )

    const file = new File(["support details"], "new.txt", { type: "text/plain" })
    await user.upload(await screen.findByLabelText("Choose attachment"), file)
    await waitFor(() =>
      expect(uploadAttachmentMock).toHaveBeenCalledWith(
        { type: "ticket", id: "ticket-1" },
        file,
      ),
    )
    const link = await screen.findByRole("link", { name: "details.txt" })
    expect(link).toHaveAttribute(
      "href",
      "/api/tickets/ticket-1/attachments/attachment-1",
    )
    expect(link).toHaveAttribute("download")
  })

  it("limits customer deletion controls to own uploads", async () => {
    const user = userEvent.setup()
    fetchAttachmentsMock.mockResolvedValue([
      {
        id: "own",
        originalName: "own.txt",
        contentType: "text/plain",
        size: 10,
        createdAt: new Date().toISOString(),
        uploaderId: "customer-1",
        uploader: { id: "customer-1", name: "Customer" },
      },
      {
        id: "staff",
        originalName: "staff.txt",
        contentType: "text/plain",
        size: 10,
        createdAt: new Date().toISOString(),
        uploaderId: "agent-1",
        uploader: { id: "agent-1", name: "Agent" },
      },
    ])

    renderWithQuery(
      <AttachmentPanel
        owner={{ type: "ticket", id: "ticket-1" }}
        currentUserId="customer-1"
      />,
    )

    await screen.findByRole("link", { name: "own.txt" })
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" })
    expect(deleteButtons).toHaveLength(1)
    await user.click(deleteButtons[0])
    await waitFor(() =>
      expect(removeAttachmentMock).toHaveBeenCalledWith(
        { type: "ticket", id: "ticket-1" },
        "own",
      ),
    )
  })
})
