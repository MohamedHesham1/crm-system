import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { readJson, requireAdmin, validationError } from "@/lib/api/http"
import { hashPassword } from "@/lib/password"
import { createUserSchema } from "@/lib/validation/user"

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return Response.json({ users })
}

export async function POST(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createUserSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { name, email, password, role } = parsed.data
  const passwordHash = await hashPassword(password)

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return Response.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { email: ["An account with this email already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
}
