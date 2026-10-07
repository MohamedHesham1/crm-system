vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import {
  DELETE as resetPermission,
  GET as getPermissions,
  PATCH as setPermission,
} from "@/app/api/admin/users/[id]/permissions/route"
import { POST as createCustomerApi } from "@/app/api/customers/route"
import { hasPermission, PERMISSIONS } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

describe("granular user permissions API", () => {
  it("preserves agent defaults and denies unknown or customer permissions", async () => {
    const agent = await createUser("AGENT")
    const customer = await createUser("CUSTOMER")

    for (const permission of PERMISSIONS) {
      expect(await hasPermission({ id: agent.id, role: "AGENT" }, permission)).toBe(true)
      expect(await hasPermission({ id: customer.id, role: "CUSTOMER" }, permission)).toBe(false)
    }
    expect(await hasPermission({ id: agent.id, role: "AGENT" }, "UNKNOWN")).toBe(false)
  })

  it("lets admins revoke and restore agent access with transactional audit entries", async () => {
    const admin = await createUser("ADMIN")
    const agent = await createUser("AGENT")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const context = routeContext({ id: agent.id })

    const initial = await getPermissions(new Request("http://test"), context)
    expect(initial.status).toBe(200)
    expect((await initial.json()).permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permission: "CUSTOMERS_MANAGE",
          defaultGranted: true,
          effectiveGranted: true,
          overridden: false,
        }),
      ]),
    )

    const revoked = await setPermission(
      jsonRequest("http://test", "PATCH", {
        permission: "CUSTOMERS_MANAGE",
        granted: false,
      }),
      context,
    )
    expect(revoked.status).toBe(200)
    expect(await hasPermission({ id: agent.id, role: "AGENT" }, "CUSTOMERS_MANAGE")).toBe(false)

    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const deniedCustomer = await createCustomerApi(
      jsonRequest("http://test/api/customers", "POST", {
        name: "Permission Denied",
        email: "denied@example.test",
        phone: "555-0100",
      }),
    )
    expect(deniedCustomer.status).toBe(403)

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const reset = await resetPermission(
      new Request("http://test/api/admin/users/permissions?permission=CUSTOMERS_MANAGE", {
        method: "DELETE",
      }),
      context,
    )
    expect(reset.status).toBe(200)
    expect(await hasPermission({ id: agent.id, role: "AGENT" }, "CUSTOMERS_MANAGE")).toBe(true)

    const audit = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: agent.id, actorId: admin.id },
      orderBy: { createdAt: "asc" },
    })
    expect(audit).toHaveLength(2)
    expect(audit.every((entry) => entry.action === "PERMISSION_CHANGED")).toBe(true)
  })

  it("rejects non-admin changes, self changes, and unknown/admin permissions", async () => {
    const admin = await createUser("ADMIN")
    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const nonAdmin = await setPermission(
      jsonRequest("http://test", "PATCH", {
        permission: "TASKS_MANAGE",
        granted: false,
      }),
      routeContext({ id: agent.id }),
    )
    expect(nonAdmin.status).toBe(403)

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const selfChange = await setPermission(
      jsonRequest("http://test", "PATCH", {
        permission: "TICKETS_READ",
        granted: false,
      }),
      routeContext({ id: admin.id }),
    )
    expect(selfChange.status).toBe(403)

    const adminGrant = await setPermission(
      jsonRequest("http://test", "PATCH", {
        permission: "ADMIN",
        granted: true,
      }),
      routeContext({ id: agent.id }),
    )
    expect(adminGrant.status).toBe(400)
    expect(await prisma.userPermission.count()).toBe(0)
  })
})
