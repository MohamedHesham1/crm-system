import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { SlaBadge } from "@/components/ui/sla-badge"

describe("SlaBadge", () => {
  it("renders the default text as a single direct match", () => {
    render(<SlaBadge />)

    expect(screen.getAllByText("SLA breached")).toHaveLength(1)
  })

  it("renders custom children", () => {
    render(<SlaBadge>3 breached</SlaBadge>)

    expect(screen.getByText("3 breached")).toBeInTheDocument()
  })
})
