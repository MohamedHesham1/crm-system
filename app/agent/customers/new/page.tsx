import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerForm } from "@/components/agent/customers/customer-form"

export default function NewCustomerPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New customer</CardTitle>
        <CardDescription>Create a customer profile.</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomerForm />
      </CardContent>
    </Card>
  )
}
