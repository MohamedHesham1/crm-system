import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ThemeProvider } from "next-themes"

import { ThemeToggle } from "@/components/theme-toggle"

describe("ThemeToggle", () => {
  it("flips the document class when clicked", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider attribute="class">
        <ThemeToggle />
      </ThemeProvider>,
    )

    const button = await screen.findByRole("button", { name: /Switch to (light|dark) theme/ })
    const wasDark = document.documentElement.classList.contains("dark")

    await user.click(button)

    expect(document.documentElement.classList.contains("dark")).toBe(!wasDark)
  })
})
