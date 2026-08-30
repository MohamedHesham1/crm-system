import { request } from "@/lib/api/client"
import type { CreateFeedbackInput } from "@/lib/validation/feedback"

/** `createdAt` arrives as an ISO **string** — `Response.json` serialises it. */
export type TicketFeedback = {
  rating: number
  comment: string | null
  createdAt: string
}

export async function postFeedback(
  ticketId: string,
  input: CreateFeedbackInput,
): Promise<TicketFeedback> {
  const { feedback } = await request<{ feedback: TicketFeedback }>(
    `/api/tickets/${ticketId}/feedback`,
    { method: "POST", body: JSON.stringify(input) },
  )
  return feedback
}
