import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const {
  fetchTasksMock,
  fetchCustomersMock,
  fetchTicketsMock,
  createTaskMock,
  updateTaskMock,
  deleteTaskMock,
} = vi.hoisted(() => ({
  fetchTasksMock: vi.fn(),
  fetchCustomersMock: vi.fn(),
  fetchTicketsMock: vi.fn(),
  createTaskMock: vi.fn(),
  updateTaskMock: vi.fn(),
  deleteTaskMock: vi.fn(),
}))

vi.mock("@/lib/tasks", () => ({
  taskKeys: {
    all: ["tasks"],
    lists: () => ["tasks", "list"],
    list: (ownerId?: string) => ["tasks", "list", ownerId ?? "default"],
    detail: (id: string) => ["tasks", "detail", id],
  },
  fetchTasks: fetchTasksMock,
  createTask: createTaskMock,
  updateTask: updateTaskMock,
  deleteTask: deleteTaskMock,
}))

vi.mock("@/lib/customers", () => ({
  customerKeys: { list: () => ["customers", "list"] },
  fetchCustomers: fetchCustomersMock,
}))

vi.mock("@/lib/tickets", () => ({
  ticketKeys: { list: () => ["tickets", "list"] },
  fetchTickets: fetchTicketsMock,
}))

vi.mock("@/lib/users", () => ({
  userKeys: { list: () => ["users", "list"] },
  fetchUsers: vi.fn().mockResolvedValue([]),
}))

import { TaskList } from "@/components/agent/tasks/task-list"

describe("TaskList", () => {
  it("keeps ticket and customer links consistent when creating a task", async () => {
    const user = userEvent.setup()
    fetchTasksMock.mockResolvedValue({ upcoming: [], overdue: [], completed: [] })
    fetchCustomersMock.mockResolvedValue({
      items: [{ id: "customer-1", name: "Customer One" }],
    })
    fetchTicketsMock.mockResolvedValue({
      items: [
        {
          id: "ticket-1",
          subject: "Ticket One",
          customer: { id: "customer-1", name: "Customer One" },
        },
      ],
    })
    createTaskMock.mockResolvedValue({})

    renderWithQuery(<TaskList isAdmin={false} />)

    await user.click(await screen.findByRole("combobox", { name: "Task ticket" }))
    await user.click(await screen.findByRole("option", { name: "Ticket One" }))
    await user.type(screen.getByLabelText("Title"), "Follow up")
    await user.click(screen.getByRole("button", { name: "Create task" }))

    await waitFor(() =>
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Follow up", ticketId: "ticket-1", customerId: "customer-1" }),
      ),
    )
  })

  it("shows overdue tasks and saves a new task from the form", async () => {
    const user = userEvent.setup()
    fetchTasksMock.mockResolvedValue({
      upcoming: [],
      overdue: [
        {
          id: "task-1",
          title: "Call customer",
          description: null,
          dueAt: new Date(Date.now() - 60_000).toISOString(),
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          owner: { id: "agent-1", name: "Agent" },
          ticket: null,
          customer: null,
        },
      ],
      completed: [],
    })
    createTaskMock.mockResolvedValue({})

    renderWithQuery(<TaskList isAdmin={false} />)

    expect(await screen.findByText("Call customer")).toBeInTheDocument()
    expect(screen.getByText("Overdue", { selector: "[data-slot='badge']" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Title"), "Follow up")
    await user.click(screen.getByRole("button", { name: "Create task" }))

    await waitFor(() => expect(createTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow up", customerId: null, ticketId: null }),
    ))
  })

  it("completes and deletes a task from its list", async () => {
    const user = userEvent.setup()
    fetchTasksMock.mockResolvedValue({
      upcoming: [
        {
          id: "task-2",
          title: "Send update",
          description: null,
          dueAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          owner: { id: "agent-1", name: "Agent" },
          ticket: null,
          customer: null,
        },
      ],
      overdue: [],
      completed: [],
    })
    updateTaskMock.mockResolvedValue({})
    deleteTaskMock.mockResolvedValue(undefined)

    renderWithQuery(<TaskList isAdmin={false} />)

    await screen.findByText("Send update")
    await user.click(screen.getByRole("button", { name: "Complete" }))
    await waitFor(() =>
      expect(updateTaskMock).toHaveBeenCalledWith("task-2", { completed: true }),
    )
    await user.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(deleteTaskMock).toHaveBeenCalledWith("task-2"))
  })
})
