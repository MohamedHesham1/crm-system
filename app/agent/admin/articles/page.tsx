import Link from "next/link"

import { ArticleTable } from "@/components/agent/admin/articles/article-table"
import { Button } from "@/components/ui/button"

export default function AdminArticlesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-meta text-muted-foreground">Customer help center</p>
          <h1 className="text-display">Knowledge base</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/agent/admin/articles/new">New article</Link>
        </Button>
      </div>
      <ArticleTable />
    </div>
  )
}
