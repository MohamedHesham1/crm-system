import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { AssignedTicketList } from "@/components/agent/dashboard/assigned-ticket-list"
import type { TicketListItem } from "@/lib/tickets"

const BREACHED: TicketListItem = {
  id: "t1",
  subject: "Breached ticket",
  category: "Account",
  priority: "HIGH",
  status: "OPEN",
  dueAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  slaBreached: true,
  customer: { id: "c1", name: "Nadia" },
  assignedAgent: null,
}

const HEALTHY: TicketListItem = {
  id: "t2",
  subject: "Healthy ticket",
  category: "Account",
  priority: "LOW",
  status: "OPEN",
  dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  slaBreached: false,
  customer: { id: "c2", name: "Owen" },
  assignedAgent: null,
}

describe("AssignedTicketList", () => {
  it("badges only the breached ticket", () => {
    render(<AssignedTicketList tickets={[BREACHED, HEALTHY]} />)

    expect(screen.getAllByText("SLA breached")).toHaveLength(1)
    const row = screen.getByRole("row", { name: /Breached ticket/ })
    expect(within(row).getByText("SLA breached")).toBeInTheDocument()
  })
})
