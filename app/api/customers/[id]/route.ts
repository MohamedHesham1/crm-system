import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { updateCustomerSchema } from "@/lib/validation/customer"

const CUSTOMER_PROFILE_INCLUDE = {
  tickets: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      assignedAgent: { select: { id: true, name: true } },
    },
  },
}

export const GET = withAuth(
  { role: "agent" },
  async (_request, ctx: RouteContext<"/api/customers/[id]">) => {
    const { id } = await ctx.params

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: CUSTOMER_PROFILE_INCLUDE,
    })
    if (!customer) return notFound("Customer not found.")

    return Response.json({ customer })
  },
)

export const PATCH = withAuth(
  { role: "agent" },
  async (request, ctx: RouteContext<"/api/customers/[id]">) => {
    const { id } = await ctx.params

    const body = await readJson(request)
    if (!body.ok) return body.response

    const parsed = updateCustomerSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const { company, ...rest } = parsed.data
    const data = {
      ...rest,
      ...(company === undefined ? {} : { company: company || null }),
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "Provide at least one field to update." }, { status: 400 })
    }

    try {
      const customer = await prisma.customer.update({
        where: { id },
        data,
        include: CUSTOMER_PROFILE_INCLUDE,
      })
      return Response.json({ customer })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") return notFound("Customer not found.")
        if (error.code === "P2002") {
          return Response.json(
            {
              error: "Validation failed",
              fieldErrors: { email: ["A customer with this email already exists."] },
            },
            { status: 409 },
          )
        }
      }
      throw error
    }
  },
)
