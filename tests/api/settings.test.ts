vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET as getSettings, PATCH as updateSettings, POST as createCategory } from "@/app/api/admin/settings/route"
import { GET as getCategories } from "@/app/api/ticket-categories/route"
import { POST as createTicket } from "@/app/api/tickets/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createUser } from "@/tests/helpers/factories"
import { jsonRequest } from "@/tests/helpers/request"
import { TICKET_PRIORITIES } from "@/lib/validation/ticket"

describe("ticket settings API", () => {
  it("returns defaults, manages category lifecycle, and preserves historical ticket text", async () => {
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const defaults = await getSettings(new Request("http://test/api/admin/settings"))
    const settings = await defaults.json()
    expect(settings.categories.map((category: { name: string }) => category.name)).toEqual(["Billing"])
    expect(settings.slaTargets).toEqual([
      { priority: "LOW", responseHours: 72, resolutionHours: 72 },
      { priority: "MEDIUM", responseHours: 24, resolutionHours: 24 },
      { priority: "HIGH", responseHours: 4, resolutionHours: 4 },
    ])

    const created = await createCategory(
      jsonRequest("http://test/api/admin/settings", "POST", { name: "Technical" }),
    )
    expect(created.status).toBe(201)
    const category = (await created.json()).category
    expect(category.sortOrder).toBe(1)

    const duplicate = await createCategory(
      jsonRequest("http://test/api/admin/settings", "POST", { name: " technical " }),
    )
    expect(duplicate.status).toBe(409)

    const historical = await createTicket(
      jsonRequest("http://test/api/tickets", "POST", {
        subject: "Historical category",
        description: "Keep original ticket text.",
        category: "Billing",
        priority: "MEDIUM",
        customerId: customer.id,
      }),
    )
    expect(historical.status).toBe(201)
    const oldTicket = (await historical.json()).ticket

    const renamed = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", {
        category: { id: category.id, name: "Platform", sortOrder: 0 },
      }),
    )
    expect(renamed.status).toBe(200)

    const deactivated = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", {
        category: { id: category.id, active: false },
      }),
    )
    expect(deactivated.status).toBe(200)
    const activeList = await getCategories(new Request("http://test/api/ticket-categories"))
    expect((await activeList.json()).categories.map((item: { name: string }) => item.name)).toEqual([
      "Billing",
    ])

    const rejected = await createTicket(
      jsonRequest("http://test/api/tickets", "POST", {
        subject: "Inactive category",
        description: "Must choose active category.",
        category: "Platform",
        priority: "HIGH",
        customerId: customer.id,
      }),
    )
    expect(rejected.status).toBe(400)
    expect((await rejected.json()).fieldErrors.category).toBeDefined()

    const storedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: oldTicket.id } })
    expect(storedTicket.category).toBe("Billing")
    expect(await prisma.auditLog.count({ where: { action: "SETTINGS_CHANGED" } })).toBeGreaterThanOrEqual(3)

    const lastCategory = settings.categories[0]
    const cannotDeactivateLast = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", {
        category: { id: lastCategory.id, active: false },
      }),
    )
    expect(cannotDeactivateLast.status).toBe(400)
  })

  it("applies changed resolution targets only to new tickets and validates target bounds", async () => {
    const admin = await createUser("ADMIN")
    const customer = await createCustomer()
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const beforeResponse = await createTicket(
      jsonRequest("http://test/api/tickets", "POST", {
        subject: "Before target change",
        description: "Existing deadline stays fixed.",
        category: "Billing",
        priority: "MEDIUM",
        customerId: customer.id,
      }),
    )
    const beforeTicket = (await beforeResponse.json()).ticket
    const originalDueAt = beforeTicket.dueAt

    const targets = TICKET_PRIORITIES.map((priority) => ({
      priority,
      responseHours: priority === "MEDIUM" ? 3 : 5,
      resolutionHours: priority === "MEDIUM" ? 2 : 6,
    }))
    const updated = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", { slaTargets: targets }),
    )
    expect(updated.status).toBe(200)

    const afterResponse = await createTicket(
      jsonRequest("http://test/api/tickets", "POST", {
        subject: "After target change",
        description: "Uses current resolution target.",
        category: "Billing",
        priority: "MEDIUM",
        customerId: customer.id,
      }),
    )
    const afterTicket = (await afterResponse.json()).ticket
    const resolutionHours =
      (new Date(afterTicket.dueAt).getTime() - new Date(afterTicket.createdAt).getTime()) /
      (60 * 60 * 1000)
    expect(resolutionHours).toBeCloseTo(2, 2)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: beforeTicket.id } })).dueAt?.toISOString()).toBe(
      originalDueAt,
    )

    const invalid = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", {
        slaTargets: targets.map((target) =>
          target.priority === "MEDIUM" ? { ...target, resolutionHours: 0 } : target,
        ),
      }),
    )
    expect(invalid.status).toBe(400)
    const tooLarge = await updateSettings(
      jsonRequest("http://test/api/admin/settings", "PATCH", {
        slaTargets: targets.map((target) =>
          target.priority === "MEDIUM" ? { ...target, responseHours: 8_761 } : target,
        ),
      }),
    )
    expect(tooLarge.status).toBe(400)
  })

  it("restricts configuration writes and reads to admins", async () => {
    const agent = await createUser("AGENT")
    const customer = await createUser("CUSTOMER")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    expect((await getSettings(new Request("http://test"))).status).toBe(403)
    expect(
      (
        await createCategory(
          jsonRequest("http://test", "POST", { name: "Restricted" }),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await updateSettings(
          jsonRequest("http://test", "PATCH", {
            category: { id: "category-id", active: false },
          }),
        )
      ).status,
    ).toBe(403)

    signInAs({ id: customer.id, name: customer.name, role: "CUSTOMER" })
    expect((await getSettings(new Request("http://test"))).status).toBe(403)
    expect((await getCategories(new Request("http://test"))).status).toBe(200)

    signInAs(null)
    expect((await getSettings(new Request("http://test"))).status).toBe(401)
    expect((await getCategories(new Request("http://test"))).status).toBe(401)
  })
})
