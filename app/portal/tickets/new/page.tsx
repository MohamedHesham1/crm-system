import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PortalTicketForm } from "@/components/portal/tickets/portal-ticket-form"

export default function NewPortalTicketPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New ticket</CardTitle>
        <CardDescription>Tell us what&apos;s going on and we&apos;ll take a look.</CardDescription>
      </CardHeader>
      <CardContent>
        <PortalTicketForm />
      </CardContent>
    </Card>
  )
}
