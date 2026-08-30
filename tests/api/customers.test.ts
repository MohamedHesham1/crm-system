vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET, POST } from "@/app/api/customers/route"
import { prisma } from "@/lib/prisma"
import { createUser } from "@/tests/helpers/factories"
import { jsonRequest } from "@/tests/helpers/request"

describe("customers API", () => {
  it("creates a customer and lists it", async () => {
    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const postResponse = await POST(
      jsonRequest("http://test/api/customers", "POST", {
        name: "Nadia Northwind",
        email: "nadia@northwind.example",
        phone: "+1 555 0100",
      }),
    )
    expect(postResponse.status).toBe(201)
    const posted = await postResponse.json()
    expect(posted.customer.id).toBeDefined()

    const getResponse = await GET()
    expect(getResponse.status).toBe(200)
    const listed = await getResponse.json()
    expect(listed.customers.some((customer: { email: string }) => customer.email === "nadia@northwind.example")).toBe(true)
  })

  it("rejects a customer with no phone", async () => {
    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const response = await POST(
      jsonRequest("http://test/api/customers", "POST", {
        name: "No Phone",
        email: "nophone@northwind.example",
        phone: "",
      }),
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.fieldErrors.phone).toEqual(["Phone is required."])
    expect(await prisma.customer.count()).toBe(0)
  })
})
