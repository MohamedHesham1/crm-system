import { request } from "@/lib/api/client"
import type { ArticleStatus, CreateArticleInput, UpdateArticleInput } from "@/lib/validation/article"

export type ArticleItem = {
  id: string
  title: string
  slug: string
  summary: string
  body: string
  category: string
  status: ArticleStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  author: { id: string; name: string }
}

export type ArticleSummary = Pick<
  ArticleItem,
  "id" | "title" | "slug" | "summary" | "category" | "publishedAt"
>

export type PublicArticle = Pick<
  ArticleItem,
  "id" | "title" | "slug" | "summary" | "body" | "category" | "status" | "publishedAt"
>

export const articleKeys = {
  all: ["articles"] as const,
  adminList: () => [...articleKeys.all, "admin"] as const,
  adminDetail: (id: string) => [...articleKeys.all, "admin-detail", id] as const,
  search: (query: string, page = 1) => [...articleKeys.all, "search", query, page] as const,
  detail: (slug: string) => [...articleKeys.all, "detail", slug] as const,
}

export async function fetchArticles(): Promise<ArticleItem[]> {
  const { articles } = await request<{ articles: ArticleItem[] }>("/api/admin/articles")
  return articles
}

export async function fetchAdminArticle(id: string): Promise<ArticleItem> {
  const { article } = await request<{ article: ArticleItem }>(
    `/api/admin/articles/${encodeURIComponent(id)}`,
  )
  return article
}

export async function createArticle(input: CreateArticleInput): Promise<ArticleItem> {
  const { article } = await request<{ article: ArticleItem }>("/api/admin/articles", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return article
}

export async function updateArticle(id: string, input: UpdateArticleInput): Promise<ArticleItem> {
  const { article } = await request<{ article: ArticleItem }>(
    `/api/admin/articles/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  )
  return article
}

export async function fetchKnowledgeBase(query = "", page = 1): Promise<{
  articles: ArticleSummary[]
  page: number
  limit: number
  total: number
}> {
  const params = new URLSearchParams({ page: String(page), limit: "10" })
  if (query) params.set("q", query)
  return request(`/api/knowledge-base?${params}`)
}

export async function fetchKnowledgeArticle(slug: string): Promise<PublicArticle> {
  const { article } = await request<{ article: PublicArticle }>(
    `/api/knowledge-base/${encodeURIComponent(slug)}`,
  )
  return article
}
