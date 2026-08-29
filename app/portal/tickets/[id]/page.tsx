import { PortalTicketDetail } from "@/components/portal/tickets/portal-ticket-detail"

export default async function PortalTicketDetailPage(props: PageProps<"/portal/tickets/[id]">) {
  const { id } = await props.params
  return <PortalTicketDetail ticketId={id} />
}
