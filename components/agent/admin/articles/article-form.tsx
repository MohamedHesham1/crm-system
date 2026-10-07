"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, type FieldErrors } from "@/lib/api/client"
import {
  articleKeys,
  createArticle,
  fetchAdminArticle,
  updateArticle,
  type ArticleItem,
} from "@/lib/articles"
import { ARTICLE_STATUSES, createArticleSchema, type ArticleStatus } from "@/lib/validation/article"

type Values = {
  title: string
  slug: string
  summary: string
  body: string
  category: string
  status: ArticleStatus
}

const EMPTY_VALUES: Values = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  category: "",
  status: "DRAFT",
}

function articleValues(article: ArticleItem): Values {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    body: article.body,
    category: article.category,
    status: article.status,
  }
}

export function ArticleForm({ articleId }: { articleId?: string }) {
  const articleQuery = useQuery({
    queryKey: articleKeys.adminDetail(articleId ?? "new"),
    queryFn: () => fetchAdminArticle(articleId!),
    enabled: Boolean(articleId),
  })

  if (articleQuery.isPending && articleId) return <p className="text-meta">Loading article…</p>
  if (articleQuery.isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {articleQuery.error instanceof Error ? articleQuery.error.message : "Could not load article."}
      </p>
    )
  }

  return (
    <ArticleEditor
      key={articleQuery.data?.updatedAt ?? "new"}
      articleId={articleId}
      initialArticle={articleQuery.data}
    />
  )
}

function ArticleEditor({
  articleId,
  initialArticle,
}: {
  articleId?: string
  initialArticle?: ArticleItem
}) {
  const [values, setValues] = useState<Values>(() =>
    initialArticle ? articleValues(initialArticle) : EMPTY_VALUES,
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const router = useRouter()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: Values) =>
      articleId ? updateArticle(articleId, input) : createArticle(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: articleKeys.adminList() }),
        queryClient.invalidateQueries({ queryKey: articleKeys.all }),
      ])
      router.push("/agent/admin/articles")
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createArticleSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFieldErrors({})
    mutation.mutate(parsed.data)
  }

  const formError =
    mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length === 0
      ? mutation.error.message
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ArticleField
        id="title"
        label="Title"
        value={values.title}
        error={fieldErrors.title?.[0]}
        onChange={(title) => setValues((current) => ({ ...current, title }))}
      />
      <ArticleField
        id="slug"
        label="URL slug"
        value={values.slug}
        error={fieldErrors.slug?.[0]}
        hint="Use lowercase letters, numbers, and hyphens."
        onChange={(slug) => setValues((current) => ({ ...current, slug }))}
      />
      <ArticleField
        id="category"
        label="Category"
        value={values.category}
        error={fieldErrors.category?.[0]}
        onChange={(category) => setValues((current) => ({ ...current, category }))}
      />
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={values.summary}
          onChange={(event) => setValues((current) => ({ ...current, summary: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.summary)}
          rows={3}
        />
        {fieldErrors.summary ? <FieldError>{fieldErrors.summary[0]}</FieldError> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Article</Label>
        <Textarea
          id="body"
          value={values.body}
          onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.body)}
          rows={12}
        />
        <p className="text-meta text-muted-foreground">Plain text only; formatting and HTML are not rendered.</p>
        {fieldErrors.body ? <FieldError>{fieldErrors.body[0]}</FieldError> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={values.status}
          onChange={(event) => {
            const status = ARTICLE_STATUSES.find((value) => value === event.target.value)
            if (status) setValues((current) => ({ ...current, status }))
          }}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {ARTICLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      {formError ? <FieldError>{formError}</FieldError> : null}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : articleId ? "Save changes" : "Create article"}
      </Button>
    </form>
  )
}

function ArticleField({
  id,
  label,
  value,
  error,
  hint,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {hint ? <p className="text-meta text-muted-foreground">{hint}</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="text-meta text-destructive">{children}</p>
}
