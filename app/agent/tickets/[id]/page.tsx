import { TicketDetail } from "@/components/agent/tickets/ticket-detail"

export default async function TicketDetailPage(props: PageProps<"/agent/tickets/[id]">) {
  const { id } = await props.params
  return <TicketDetail ticketId={id} />
}
