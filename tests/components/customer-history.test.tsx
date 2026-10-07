import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchCustomerMock, updateCustomerMock } = vi.hoisted(() => ({
  fetchCustomerMock: vi.fn(),
  updateCustomerMock: vi.fn(),
}))

vi.mock("@/lib/customers", () => ({
  customerKeys: { detail: (id: string) => ["customers", id], all: ["customers"] },
  fetchCustomer: fetchCustomerMock,
  updateCustomer: updateCustomerMock,
}))

vi.mock("@/components/shared/attachment-panel", () => ({
  AttachmentPanel: () => null,
}))

import { CustomerProfile } from "@/components/agent/customers/customer-profile"

describe("CustomerProfile history", () => {
  it("shows ticket links or an empty history state", async () => {
    fetchCustomerMock.mockResolvedValue({
      id: "customer-1",
      name: "Customer One",
      email: "customer@example.test",
      phone: "555-0100",
      company: null,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tickets: [
        {
          id: "ticket-1",
          subject: "Cannot sign in",
          status: "OPEN",
          priority: "HIGH",
          createdAt: new Date().toISOString(),
          assignedAgent: { id: "agent-1", name: "Agent One" },
        },
      ],
    })

    renderWithQuery(<CustomerProfile customerId="customer-1" />)

    expect(await screen.findByRole("link", { name: "Cannot sign in" })).toHaveAttribute(
      "href",
      "/agent/tickets/ticket-1",
    )
    expect(screen.getByText(/Agent One/)).toBeInTheDocument()
  })
})
