import { prisma } from "@/lib/prisma"
import { ARTICLE_SUMMARY_SELECT } from "@/lib/article-select"
import { validationError, withAuth } from "@/lib/api/http"
import { articleSearchSchema } from "@/lib/validation/article"

export const GET = withAuth({ role: "viewer" }, async (request) => {
  const params = new URL(request.url).searchParams
  const parsed = articleSearchSchema.safeParse({
    ...(params.has("q") ? { q: params.get("q") } : {}),
    ...(params.has("page") ? { page: params.get("page") } : {}),
    ...(params.has("limit") ? { limit: params.get("limit") } : {}),
  })
  if (!parsed.success) return validationError(parsed.error)

  const { q, page, limit } = parsed.data
  const where = {
    status: "PUBLISHED",
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { body: { contains: q } },
            { category: { contains: q } },
          ],
        }
      : {}),
  }
  const [articles, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: ARTICLE_SUMMARY_SELECT,
    }),
    prisma.knowledgeArticle.count({ where }),
  ])

  return Response.json({ articles, page, limit, total })
})
