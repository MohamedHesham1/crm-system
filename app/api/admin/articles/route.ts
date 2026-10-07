import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { ARTICLE_SELECT } from "@/lib/article-select"
import { readJson, validationError, withAuth } from "@/lib/api/http"
import { createArticleSchema } from "@/lib/validation/article"

export const GET = withAuth({ role: "admin" }, async () => {
  const articles = await prisma.knowledgeArticle.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: ARTICLE_SELECT,
  })
  return Response.json({ articles })
})

export const POST = withAuth({ role: "admin" }, async (request, _ctx, user) => {
  const body = await readJson(request)
  if (!body.ok) return body.response

  const parsed = createArticleSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { status, ...fields } = parsed.data
  try {
    const article = await prisma.knowledgeArticle.create({
      data: {
        ...fields,
        status,
        authorId: user.id,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
      select: ARTICLE_SELECT,
    })
    return Response.json({ article }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        {
          error: "Validation failed",
          fieldErrors: { slug: ["An article with this slug already exists."] },
        },
        { status: 409 },
      )
    }
    throw error
  }
})
