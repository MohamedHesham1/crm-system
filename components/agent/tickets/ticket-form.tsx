"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { customerKeys, fetchCustomers } from "@/lib/customers"
import { ApiError, createTicket, ticketKeys, type FieldErrors } from "@/lib/tickets"
import { createTicketSchema, TICKET_PRIORITIES, type TicketPriority } from "@/lib/validation/ticket"

type Values = {
  subject: string
  description: string
  category: string
  priority: TicketPriority
  customerId: string
  dueAt: string
  assignToMe: boolean
}

const INITIAL_VALUES: Values = {
  subject: "",
  description: "",
  category: "",
  priority: "MEDIUM",
  customerId: "",
  dueAt: "",
  assignToMe: false,
}

export function TicketForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const queryClient = useQueryClient()
  const router = useRouter()

  // `pageSize: 100` (the server-side maximum) rather than the default 25:
  // this list feeds a select dropdown, not a paged table.
  const { data: customerPage } = useQuery({
    queryKey: customerKeys.list(1),
    queryFn: () => fetchCustomers(1, 100),
  })
  const customers = customerPage?.items

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all })
      router.push(`/agent/tickets/${ticket.id}`)
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // datetime-local has no seconds/offset ("2026-08-30T14:30"); convert to
    // ISO before it reaches z.iso.datetime(). Empty means "no dueAt key at
    // all" so the server applies its own default.
    const input = {
      subject: values.subject,
      description: values.description,
      category: values.category,
      priority: values.priority,
      customerId: values.customerId,
      assignToMe: values.assignToMe,
      ...(values.dueAt ? { dueAt: new Date(values.dueAt).toISOString() } : {}),
    }

    const parsed = createTicketSchema.safeParse(input)
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

  const noCustomers = customers !== undefined && customers.length === 0

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
          <p role="alert" className="text-meta text-destructive">
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
          <p role="alert" className="text-meta text-destructive">
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
          <p role="alert" className="text-meta text-destructive">
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

      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        {noCustomers ? (
          <p className="text-meta text-muted-foreground">
            No customers yet.{" "}
            <Link href="/agent/customers/new" className="underline underline-offset-4">
              Create a customer first.
            </Link>
          </p>
        ) : (
          <Select
            value={values.customerId}
            onValueChange={(value) => setValues((prev) => ({ ...prev, customerId: value }))}
          >
            <SelectTrigger id="customerId" className="w-full">
              <SelectValue placeholder="Choose a customer" />
            </SelectTrigger>
            <SelectContent>
              {(customers ?? []).map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fieldErrors.customerId ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.customerId[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueAt">Due date (optional)</Label>
        <Input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          value={values.dueAt}
          onChange={(event) => setValues((prev) => ({ ...prev, dueAt: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.dueAt)}
        />
        {fieldErrors.dueAt ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.dueAt[0]}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="assignToMe"
          type="checkbox"
          checked={values.assignToMe}
          onChange={(event) => setValues((prev) => ({ ...prev, assignToMe: event.target.checked }))}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="assignToMe">Assign to me</Label>
      </div>

      {formError ? (
        <p role="alert" className="text-meta text-destructive">
          {formError}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={mutation.isPending || noCustomers || !values.customerId}
      >
        {mutation.isPending ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  )
}
