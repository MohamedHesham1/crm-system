import type { Prisma } from "@prisma/client"

export const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  body: true,
  category: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.KnowledgeArticleSelect

export const ARTICLE_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  publishedAt: true,
} satisfies Prisma.KnowledgeArticleSelect

export const PUBLIC_ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  body: true,
  category: true,
  status: true,
  publishedAt: true,
} satisfies Prisma.KnowledgeArticleSelect
