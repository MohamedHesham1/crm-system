vi.mock("@/auth", () => import("@/tests/mocks/auth"))

import { describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/register/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createUser } from "@/tests/helpers/factories"
import { jsonRequest } from "@/tests/helpers/request"

describe("register API", () => {
  it("creates a linked User and Customer for a new email", async () => {
    const response = await POST(
      jsonRequest("http://test/api/register", "POST", {
        name: "Nadia Northwind",
        email: "nadia@northwind.example",
        password: "password123",
      }),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.linked).toBe(false)

    const customer = await prisma.customer.findUnique({ where: { userId: body.userId } })
    expect(customer?.userId).toBe(body.userId)
    expect(await prisma.customer.count()).toBe(1)
  })

  it("links to an existing unlinked customer instead of duplicating", async () => {
    const existing = await createCustomer({ email: "nadia@northwind.example" })

    const response = await POST(
      jsonRequest("http://test/api/register", "POST", {
        name: "Nadia Northwind",
        email: "Nadia@Northwind.example",
        password: "password123",
      }),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.linked).toBe(true)
    expect(body.customerId).toBe(existing.id)
    expect(await prisma.customer.count()).toBe(1)
  })

  it("rejects a duplicate email", async () => {
    await createUser("CUSTOMER", { email: "taken@northwind.example" })

    const response = await POST(
      jsonRequest("http://test/api/register", "POST", {
        name: "Someone Else",
        email: "taken@northwind.example",
        password: "password123",
      }),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.fieldErrors.email).toEqual(["An account with this email already exists. Sign in instead."])
    expect(await prisma.user.count()).toBe(1)
  })
})
