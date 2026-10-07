"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { articleKeys, fetchKnowledgeBase } from "@/lib/articles"

export function KnowledgeBaseSearch() {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error } = useQuery({
    queryKey: articleKeys.search(query, page),
    queryFn: () => fetchKnowledgeBase(query, page),
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(search.trim())
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Search help articles"
          placeholder="Try “invoice”, “account”, or a question"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit">Search articles</Button>
      </form>

      <section aria-live="polite" className="space-y-3">
        {isPending ? <Spinner label="Searching help articles…" /> : null}
        {isError ? (
          <p role="alert" className="text-meta text-destructive">
            {error instanceof Error ? error.message : "Could not search help articles."}
          </p>
        ) : null}
        {data && data.articles.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-meta text-muted-foreground">
            No published articles match that search. Try another term or raise a support ticket.
          </p>
        ) : null}
        {data?.articles.map((article) => (
          <article
            key={article.id}
            className="grid gap-3 rounded-lg border-l-4 border-l-primary bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-medium">
                <Link
                  href={`/portal/knowledge-base/${encodeURIComponent(article.slug)}`}
                  className="underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {article.title}
                </Link>
              </h2>
              <p className="text-meta text-muted-foreground">{article.summary}</p>
            </div>
            <Badge variant="secondary">{article.category}</Badge>
          </article>
        ))}
      </section>

      {data && data.total > data.limit ? (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-meta text-muted-foreground">
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page === 1 || isPending}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page * data.limit >= data.total || isPending}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
