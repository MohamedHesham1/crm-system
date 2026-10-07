"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { customerKeys, fetchCustomers } from "@/lib/customers"
import { ticketKeys, fetchTickets } from "@/lib/tickets"
import { fetchUsers, userKeys } from "@/lib/users"
import type { TaskItem } from "@/lib/tasks"
import type { CreateTaskInput } from "@/lib/validation/task"

const NONE = "__none__"

function toLocalDateTime(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function TaskForm({
  task,
  isAdmin,
  defaultOwnerId,
  isPending,
  onSave,
  onCancel,
}: {
  task: TaskItem | null
  isAdmin: boolean
  defaultOwnerId: string
  isPending: boolean
  onSave: (input: CreateTaskInput) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [dueAt, setDueAt] = useState(toLocalDateTime(task?.dueAt ?? null))
  const [ticketId, setTicketId] = useState(task?.ticket?.id ?? NONE)
  const [customerId, setCustomerId] = useState(task?.customer?.id ?? NONE)
  const [ownerId, setOwnerId] = useState(task?.owner.id ?? defaultOwnerId)

  const { data: customers } = useQuery({
    queryKey: customerKeys.list(),
    queryFn: () => fetchCustomers(1, 100),
  })
  const { data: tickets } = useQuery({
    queryKey: ticketKeys.list({ pageSize: 100 }),
    queryFn: () => fetchTickets({ pageSize: 100 }),
  })
  const { data: users } = useQuery({
    queryKey: userKeys.list(),
    queryFn: fetchUsers,
    enabled: isAdmin,
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({
      title,
      description: description.trim() ? description : undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      ticketId: ticketId === NONE ? null : ticketId,
      customerId: customerId === NONE ? (ticketId === NONE ? null : undefined) : customerId,
      ...(isAdmin ? { ownerId } : {}),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{task ? "Edit task" : "Create task"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              maxLength={200}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              rows={3}
              maxLength={2_000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Customer</Label>
              <Select
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(value)
                  const selectedTicket = tickets?.items.find((ticket) => ticket.id === ticketId)
                  if (selectedTicket && selectedTicket.customer.id !== value) setTicketId(NONE)
                }}
              >
                <SelectTrigger aria-label="Task customer" className="w-full">
                  <SelectValue placeholder="No customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No customer</SelectItem>
                  {(customers?.items ?? []).map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ticket</Label>
              <Select
                value={ticketId}
                onValueChange={(value) => {
                  setTicketId(value)
                  const selectedTicket = tickets?.items.find((ticket) => ticket.id === value)
                  if (selectedTicket) setCustomerId(selectedTicket.customer.id)
                }}
              >
                <SelectTrigger aria-label="Task ticket" className="w-full">
                  <SelectValue placeholder="No ticket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No ticket</SelectItem>
                  {(tickets?.items ?? []).map((ticket) => (
                    <SelectItem key={ticket.id} value={ticket.id}>
                      {ticket.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin ? (
              <div className="space-y-1">
                <Label>Assign to</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger aria-label="Task owner" className="w-full">
                    <SelectValue placeholder="Choose staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users ?? [])
                      .filter((user) => user.role !== "CUSTOMER")
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : task ? "Save task" : "Create task"}
            </Button>
            {task ? (
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
