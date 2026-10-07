import { ArticleForm } from "@/components/agent/admin/articles/article-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewArticlePage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New help article</CardTitle>
        <CardDescription>Write a clear answer customers can find in the portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <ArticleForm />
      </CardContent>
    </Card>
  )
}
