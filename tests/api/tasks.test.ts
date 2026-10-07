vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET as getDashboard } from "@/app/api/dashboard/route"
import { GET as getTask, PATCH as patchTask, DELETE as deleteTask } from "@/app/api/tasks/[id]/route"
import { GET as getTasks, POST as createTask } from "@/app/api/tasks/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

function taskRequest(input: unknown) {
  return jsonRequest("http://test/api/tasks", "POST", input)
}

describe("staff tasks API", () => {
  it("creates a task for the signed-in agent and validates linked ticket/customer", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await createTask(
      taskRequest({
        title: "Follow up with customer",
        description: "Confirm the workaround helped.",
        dueAt: new Date(Date.now() + 60_000).toISOString(),
        ticketId: ticket.id,
      }),
    )
    expect(response.status).toBe(201)
    const { task } = await response.json()
    expect(task.owner.id).toBe(agent.id)
    expect(task.ticket.id).toBe(ticket.id)
    expect(task.customer.id).toBe(customer.id)
    expect(task.completedAt).toBeNull()

    const taskResponse = await getTask(
      new Request("http://test"),
      routeContext({ id: task.id }),
    )
    expect((await taskResponse.json()).task.id).toBe(task.id)

    const listResponse = await getTasks(new Request("http://test/api/tasks"))
    const lists = await listResponse.json()
    expect(lists.upcoming.map((item: { id: string }) => item.id)).toContain(task.id)

    const dashboard = await getDashboard(new Request("http://test/api/dashboard"))
    expect((await dashboard.json()).tasks.upcoming.map((item: { id: string }) => item.id)).toContain(
      task.id,
    )
  })

  it("groups overdue, undated, and completed tasks and scopes results to owner", async () => {
    const agent = await createUser("AGENT")
    const otherAgent = await createUser("AGENT")
    const customer = await createCustomer()
    const overdue = await prisma.task.create({
      data: {
        title: "Overdue follow-up",
        ownerId: agent.id,
        dueAt: new Date(Date.now() - 60_000),
      },
    })
    const undated = await prisma.task.create({
      data: { title: "Unscheduled follow-up", ownerId: agent.id },
    })
    await prisma.task.create({
      data: {
        title: "Completed follow-up",
        ownerId: agent.id,
        dueAt: new Date(Date.now() - 120_000),
        completedAt: new Date(),
      },
    })
    const privateTask = await prisma.task.create({
      data: { title: "Other agent task", ownerId: otherAgent.id, customerId: customer.id },
    })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await getTasks(new Request("http://test/api/tasks"))
    const lists = await response.json()
    expect(lists.overdue.map((item: { id: string }) => item.id)).toEqual([overdue.id])
    expect(lists.upcoming.map((item: { id: string }) => item.id)).toEqual([undated.id])
    expect(JSON.stringify(lists)).not.toContain(privateTask.id)

    signInAs({ id: otherAgent.id, name: otherAgent.name, role: "AGENT" })
    expect(
      (
        await getTask(new Request("http://test"), routeContext({ id: overdue.id }))
      ).status,
    ).toBe(404)
    expect(
      (
        await patchTask(
          jsonRequest("http://test", "PATCH", { title: "Steal task" }),
          routeContext({ id: overdue.id }),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await deleteTask(
          new Request("http://test", { method: "DELETE" }),
          routeContext({ id: overdue.id }),
        )
      ).status,
    ).toBe(404)

    const customerUser = await createUser("CUSTOMER")
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    expect((await getTasks(new Request("http://test"))).status).toBe(403)
  })

  it("lets admins manage staff tasks while rejecting customer task owners", async () => {
    const admin = await createUser("ADMIN")
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const created = await createTask(taskRequest({ title: "Admin-assigned task", ownerId: agent.id }))
    expect(created.status).toBe(201)
    const task = (await created.json()).task
    expect(task.owner.id).toBe(agent.id)

    const allTasks = await getTasks(new Request("http://test/api/tasks?ownerId=all"))
    expect((await allTasks.json()).upcoming.map((item: { id: string }) => item.id)).toContain(task.id)

    const invalidOwner = await createTask(taskRequest({ title: "Invalid owner", ownerId: customerUser.id }))
    expect(invalidOwner.status).toBe(400)

    const complete = await patchTask(
      jsonRequest("http://test", "PATCH", { completed: true }),
      routeContext({ id: task.id }),
    )
    expect(complete.status).toBe(200)
    const completedTask = (await complete.json()).task
    expect(completedTask.completedAt).not.toBeNull()

    const undo = await patchTask(
      jsonRequest("http://test", "PATCH", { completed: false }),
      routeContext({ id: task.id }),
    )
    expect((await undo.json()).task.completedAt).toBeNull()
  })

  it("rejects nonexistent, deleted, and mismatched ticket/customer links", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const otherCustomer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    const deletedTicket = await createTicket({ customerId: customer.id })
    await prisma.ticket.update({ where: { id: deletedTicket.id }, data: { deletedAt: new Date() } })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    for (const body of [
      { title: "Missing ticket", ticketId: "not-a-ticket" },
      { title: "Deleted ticket", ticketId: deletedTicket.id },
      { title: "Mismatched customer", ticketId: ticket.id, customerId: otherCustomer.id },
      { title: "Missing customer", customerId: "not-a-customer" },
    ]) {
      expect((await createTask(taskRequest(body))).status).toBe(400)
    }
    expect(await prisma.task.count()).toBe(0)
  })
})
