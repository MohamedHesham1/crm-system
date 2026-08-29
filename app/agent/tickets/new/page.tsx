import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketForm } from "@/components/agent/tickets/ticket-form"

export default function NewTicketPage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New ticket</CardTitle>
        <CardDescription>Raise a ticket for an existing customer.</CardDescription>
      </CardHeader>
      <CardContent>
        <TicketForm />
      </CardContent>
    </Card>
  )
}
