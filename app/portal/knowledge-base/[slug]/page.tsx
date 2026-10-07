import type { Metadata } from "next"

import { KnowledgeArticle } from "@/components/portal/knowledge-base/knowledge-article"

export const metadata: Metadata = {
  title: "Help article",
}

export default async function KnowledgeArticlePage(
  props: PageProps<"/portal/knowledge-base/[slug]">,
) {
  const { slug } = await props.params
  return <KnowledgeArticle slug={slug} />
}
