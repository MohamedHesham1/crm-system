import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserForm } from "@/components/agent/admin/user-form"

export default function NewUserPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New account</CardTitle>
        <CardDescription>Create an agent or admin account.</CardDescription>
      </CardHeader>
      <CardContent>
        <UserForm />
      </CardContent>
    </Card>
  )
}
