import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { ARTICLE_SELECT } from "@/lib/article-select"
import { notFound, readJson, validationError, withAuth } from "@/lib/api/http"
import { updateArticleSchema } from "@/lib/validation/article"

type ArticleContext = { params: Promise<{ id: string }> }

export const GET = withAuth(
  { role: "admin" },
  async (_request, ctx: ArticleContext) => {
    const { id } = await ctx.params
    const article = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: ARTICLE_SELECT,
    })
    if (!article) return notFound("Article not found.")
    return Response.json({ article })
  },
)

export const PATCH = withAuth(
  { role: "admin" },
  async (request, ctx: ArticleContext) => {
    const { id } = await ctx.params
    const current = await prisma.knowledgeArticle.findUnique({
      where: { id },
      select: { id: true, status: true, publishedAt: true },
    })
    if (!current) return notFound("Article not found.")

    const body = await readJson(request)
    if (!body.ok) return body.response
    const parsed = updateArticleSchema.safeParse(body.data)
    if (!parsed.success) return validationError(parsed.error)

    const { status, ...fields } = parsed.data
    const nextStatus = status ?? current.status
    try {
      const article = await prisma.knowledgeArticle.update({
        where: { id },
        data: {
          ...fields,
          ...(status === undefined ? {} : { status }),
          publishedAt:
            nextStatus === "PUBLISHED"
              ? current.status === "PUBLISHED"
                ? current.publishedAt
                : new Date()
              : null,
        },
        select: ARTICLE_SELECT,
      })
      return Response.json({ article })
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
  },
)

export const DELETE = withAuth(
  { role: "admin" },
  async (_request, ctx: ArticleContext) => {
    const { id } = await ctx.params
    const article = await prisma.knowledgeArticle.updateMany({
      where: { id },
      data: { status: "ARCHIVED", publishedAt: null },
    })
    if (article.count === 0) return notFound("Article not found.")
    return Response.json({ ok: true })
  },
)
