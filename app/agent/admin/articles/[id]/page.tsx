import { ArticleForm } from "@/components/agent/admin/articles/article-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function EditArticlePage(props: PageProps<"/agent/admin/articles/[id]">) {
  const { id } = await props.params
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Edit help article</CardTitle>
        <CardDescription>Update the article details or change its publication status.</CardDescription>
      </CardHeader>
      <CardContent>
        <ArticleForm articleId={id} />
      </CardContent>
    </Card>
  )
}
