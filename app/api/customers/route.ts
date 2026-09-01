import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { readJson, validationError, withAuth } from "@/lib/api/http"
import { parsePagination } from "@/lib/api/pagination"
import { createCustomerSchema } from "@/lib/validation/customer"

export const GET = withAuth({ role: "agent" }, async (request) => {
  const { page, pageSize, skip, take } = parsePagination(request)
  const where = {}

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: { id: true, name: true, email: true, phone: true, company: true },
    }),
    prisma.customer.count({ where }),
  ])

  return Response.json({ customers, total, page, pageSize })
})

export const POST = withAuth({ role: "agent" }, async (request) => {
  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createCustomerSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { name, email, phone, company, notes } = parsed.data

  try {
    const customer = await prisma.customer.create({
      data: { name, email, phone, company: company || null, notes: notes ?? "" },
    })
    return Response.json({ customer }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { email: ["A customer with this email already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
})
