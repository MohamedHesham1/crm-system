import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { readJson, requireAgent, validationError } from "@/lib/api/http"
import { createCustomerSchema } from "@/lib/validation/customer"

export async function GET() {
  const denied = await requireAgent()
  if (denied) return denied

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true, company: true },
  })

  return Response.json({ customers })
}

export async function POST(request: Request) {
  const denied = await requireAgent()
  if (denied) return denied

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
}
