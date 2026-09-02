import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Link from "next/link"

vi.mock("next/navigation", () => ({ usePathname: () => "/agent" }))

import { SidebarShell } from "@/components/agent/sidebar-shell"

function renderShell() {
  return render(
    <SidebarShell>
      <Link href="/agent/tickets">Tickets</Link>
    </SidebarShell>,
  )
}

describe("SidebarShell", () => {
  it("starts closed and slides open from the toggle", async () => {
    const user = userEvent.setup()
    renderShell()

    const aside = document.getElementById("agent-sidebar")
    expect(aside).toHaveClass("-translate-x-full")
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open navigation" }))

    expect(aside).toHaveClass("translate-x-0")
    expect(aside).not.toHaveClass("-translate-x-full")
    const toggle = screen
      .getAllByRole("button", { name: "Close navigation" })
      .find((button) => button.hasAttribute("aria-expanded"))
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  })

  it("closes on backdrop click", async () => {
    const user = userEvent.setup()
    renderShell()

    const aside = document.getElementById("agent-sidebar")
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(aside).toHaveClass("translate-x-0")

    const closeButtons = screen.getAllByRole("button", { name: "Close navigation" })
    await user.click(closeButtons[closeButtons.length - 1])

    expect(aside).toHaveClass("-translate-x-full")
  })

  it("closes when a nav link inside the drawer is clicked", async () => {
    const user = userEvent.setup()
    renderShell()

    const aside = document.getElementById("agent-sidebar")
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(aside).toHaveClass("translate-x-0")

    await user.click(screen.getByRole("link", { name: "Tickets" }))

    expect(aside).toHaveClass("-translate-x-full")
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    renderShell()

    const aside = document.getElementById("agent-sidebar")
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(aside).toHaveClass("translate-x-0")

    await user.keyboard("{Escape}")

    expect(aside).toHaveClass("-translate-x-full")
  })
})
