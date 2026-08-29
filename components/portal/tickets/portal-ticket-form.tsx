"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, createPortalTicket, ticketKeys, type FieldErrors } from "@/lib/tickets"
import { createPortalTicketSchema, TICKET_PRIORITIES, type TicketPriority } from "@/lib/validation/ticket"

type Values = {
  subject: string
  description: string
  category: string
  priority: TicketPriority
}

const INITIAL_VALUES: Values = { subject: "", description: "", category: "", priority: "MEDIUM" }

export function PortalTicketForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: createPortalTicket,
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
      router.push(`/portal/tickets/${ticket.id}`)
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = createPortalTicketSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }

    setFieldErrors({})
    mutation.mutate(parsed.data)
  }

  const formError =
    mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length === 0
      ? mutation.error.message
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          value={values.subject}
          onChange={(event) => setValues((prev) => ({ ...prev, subject: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.subject)}
        />
        {fieldErrors.subject ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.subject[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          value={values.description}
          onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.description[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          value={values.category}
          onChange={(event) => setValues((prev) => ({ ...prev, category: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.category)}
        />
        {fieldErrors.category ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.category[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={values.priority}
          onValueChange={(value) => setValues((prev) => ({ ...prev, priority: value as TicketPriority }))}
        >
          <SelectTrigger id="priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  )
}
