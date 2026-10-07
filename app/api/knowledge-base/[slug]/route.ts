import { prisma } from "@/lib/prisma"
import { PUBLIC_ARTICLE_SELECT } from "@/lib/article-select"
import { notFound, withAuth } from "@/lib/api/http"

type ArticleContext = { params: Promise<{ slug: string }> }

export const GET = withAuth(
  { role: "viewer" },
  async (_request, ctx: ArticleContext) => {
    const { slug } = await ctx.params
    const article = await prisma.knowledgeArticle.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: PUBLIC_ARTICLE_SELECT,
    })
    if (!article) return notFound("Article not found.")
    return Response.json({ article })
  },
)
