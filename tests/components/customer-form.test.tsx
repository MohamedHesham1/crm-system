import { describe, expect, it, vi } from "vitest"
import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { push, createCustomerMock } = vi.hoisted(() => ({
  push: vi.fn(),
  createCustomerMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/customers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/customers")>()
  return { ...actual, createCustomer: createCustomerMock }
})

import { CustomerForm } from "@/components/agent/customers/customer-form"

describe("CustomerForm", () => {
  it("shows field errors and does not submit invalid input", async () => {
    const user = userEvent.setup()
    const { container } = renderWithQuery(<CustomerForm />)

    await user.type(screen.getByLabelText("Email"), "not-an-email")
    // jsdom enforces the native `type="email"` constraint on a real click,
    // which would block `submit` before React's handler runs. Dispatch the
    // event directly so the component's own zod validation is what's tested.
    fireEvent.submit(container.querySelector("form")!)

    const alerts = await screen.findAllByRole("alert")
    const messages = alerts.map((alert) => alert.textContent)
    expect(messages).toContain("Name is required.")
    expect(messages).toContain("Enter a valid email address.")
    expect(messages).toContain("Phone is required.")
    expect(createCustomerMock).not.toHaveBeenCalled()
  })
})
