"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { articleKeys, fetchKnowledgeArticle } from "@/lib/articles"

export function KnowledgeArticle({ slug }: { slug: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: articleKeys.detail(slug),
    queryFn: () => fetchKnowledgeArticle(slug),
  })

  if (isPending) return <p className="text-meta text-muted-foreground">Loading article…</p>
  if (isError) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load this article."}
        </p>
        <Link href="/portal/knowledge-base" className="text-primary underline">
          Back to help articles
        </Link>
      </div>
    )
  }

  return (
    <article className="space-y-6">
      <Link
        href="/portal/knowledge-base"
        className="text-meta text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← All help articles
      </Link>
      <header className="space-y-3 border-b pb-5">
        <Badge variant="secondary">{data.category}</Badge>
        <h1 className="text-display">{data.title}</h1>
        <p className="text-body text-muted-foreground">{data.summary}</p>
      </header>
      <div className="max-w-prose whitespace-pre-wrap text-body leading-7 text-foreground">
        {data.body}
      </div>
    </article>
  )
}
