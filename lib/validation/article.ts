import { z } from "zod"

export const ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const

const title = z.string().trim().min(1, "Title is required.").max(160, "Title must be 160 characters or fewer.")
const slug = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(180, "Slug must be 180 characters or fewer.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.")
const summary = z
  .string()
  .trim()
  .min(1, "Summary is required.")
  .max(500, "Summary must be 500 characters or fewer.")
const body = z.string().trim().min(1, "Article body is required.").max(30_000, "Article body must be 30,000 characters or fewer.")
const category = z
  .string()
  .trim()
  .min(1, "Category is required.")
  .max(80, "Category must be 80 characters or fewer.")

export const createArticleSchema = z.object({
  title,
  slug,
  summary,
  body,
  category,
  status: z.enum(ARTICLE_STATUSES).optional().default("DRAFT"),
})

export const updateArticleSchema = z
  .object({
    title: title.optional(),
    slug: slug.optional(),
    summary: summary.optional(),
    body: body.optional(),
    category: category.optional(),
    status: z.enum(ARTICLE_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.")

export const articleSearchSchema = z.object({
  q: z.string().trim().min(1, "Search query is required.").max(120, "Search query must be 120 characters or fewer.").optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CreateArticleInput = z.input<typeof createArticleSchema>
export type UpdateArticleInput = z.input<typeof updateArticleSchema>
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]
