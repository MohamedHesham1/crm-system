import type { Metadata } from "next"

import { KnowledgeBaseSearch } from "@/components/portal/knowledge-base/knowledge-base-search"

export const metadata: Metadata = {
  title: "Help articles",
  description: "Search the support knowledge base",
}

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2 border-l-4 border-primary pl-4">
        <p className="text-meta font-medium uppercase tracking-wide text-primary">Help center</p>
        <h1 className="text-display">Find an answer, then get back to work.</h1>
        <p className="max-w-2xl text-meta text-muted-foreground">
          Search clear, practical guides from our support team. If you still need help, you can raise a ticket.
        </p>
      </header>
      <KnowledgeBaseSearch />
    </div>
  )
}
