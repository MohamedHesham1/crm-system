"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError } from "@/lib/api/client"
import { articleKeys, fetchArticles, updateArticle } from "@/lib/articles"

export function ArticleTable() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, error } = useQuery({
    queryKey: articleKeys.adminList(),
    queryFn: fetchArticles,
  })
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) =>
      updateArticle(id, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: articleKeys.adminList() }),
        queryClient.invalidateQueries({ queryKey: articleKeys.all }),
      ])
    },
  })

  if (isPending) return <Spinner label="Loading articles…" />
  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load articles."}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {mutation.isError ? (
        <p role="alert" className="text-meta text-destructive">
          {mutation.error instanceof ApiError ? mutation.error.message : "Could not update article."}
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-meta text-muted-foreground">
          No help articles yet. Create one to give customers a place to start.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((article) => (
              <TableRow key={article.id}>
                <TableCell>
                  <Link
                    href={`/agent/admin/articles/${article.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {article.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{article.category}</TableCell>
                <TableCell>
                  <Badge variant={article.status === "PUBLISHED" ? "success" : "outline"}>
                    {article.status.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {article.status !== "ARCHIVED" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            id: article.id,
                            status: article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                          })
                        }
                      >
                        {article.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </Button>
                    ) : null}
                    {article.status !== "ARCHIVED" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: article.id, status: "ARCHIVED" })}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
