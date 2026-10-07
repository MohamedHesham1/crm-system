"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { TaskForm } from "@/components/agent/tasks/task-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { dashboardKeys } from "@/lib/dashboard"
import { ApiError } from "@/lib/api/client"
import { fetchUsers, userKeys } from "@/lib/users"
import {
  createTask,
  deleteTask,
  fetchTasks,
  taskKeys,
  updateTask,
  type TaskItem,
} from "@/lib/tasks"
import type { CreateTaskInput } from "@/lib/validation/task"

const ALL_OWNERS = "all"
const MY_TASKS = "me"

export function TaskList({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [ownerFilter, setOwnerFilter] = useState(isAdmin ? ALL_OWNERS : MY_TASKS)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const queryKey = taskKeys.list(ownerFilter)
  const { data, isPending, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchTasks(ownerFilter === ALL_OWNERS ? "all" : ownerFilter),
  })
  const { data: users } = useQuery({
    queryKey: userKeys.list(),
    queryFn: fetchUsers,
    enabled: isAdmin,
  })

  async function refreshTasks() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: ({ task, input }: { task: TaskItem | null; input: CreateTaskInput }) =>
      task ? updateTask(task.id, input) : createTask(input),
    onSuccess: async () => {
      setEditingTask(null)
      setFormError(null)
      await refreshTasks()
    },
    onError: (mutationError) => {
      setFormError(
        mutationError instanceof ApiError ? mutationError.message : "Could not save task.",
      )
    },
  })
  const completeMutation = useMutation({
    mutationFn: (task: TaskItem) => updateTask(task.id, { completed: !task.completedAt }),
    onSuccess: refreshTasks,
    onError: () => setFormError("Could not update task completion."),
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: refreshTasks,
    onError: () => setFormError("Could not delete task."),
  })

  const tasks = [
    { heading: "Upcoming", items: data?.upcoming ?? [], overdue: false },
    { heading: "Overdue", items: data?.overdue ?? [], overdue: true },
    { heading: "Completed", items: data?.completed ?? [], overdue: false },
  ]

  return (
    <div className="space-y-6 pt-5">
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-medium">Tasks for</span>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger aria-label="Filter task owner" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OWNERS}>All staff</SelectItem>
              <SelectItem value={MY_TASKS}>Me</SelectItem>
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

      <TaskForm
        key={editingTask?.id ?? "new"}
        task={editingTask}
        isAdmin={isAdmin}
        defaultOwnerId={ownerFilter === ALL_OWNERS ? MY_TASKS : ownerFilter}
        isPending={saveMutation.isPending}
        onSave={(input) => saveMutation.mutate({ task: editingTask, input })}
        onCancel={() => {
          setEditingTask(null)
          setFormError(null)
        }}
      />
      {formError ? <p role="alert" className="text-meta text-destructive">{formError}</p> : null}
      {isPending ? <Spinner label="Loading tasks…" /> : null}
      {isError ? (
        <p role="alert" className="text-meta text-destructive">
          {error instanceof Error ? error.message : "Could not load tasks."}
        </p>
      ) : null}

      {!isPending && !isError
        ? tasks.map(({ heading, items, overdue }) => (
            <section key={heading} className="space-y-3">
              <h2 className="text-title">{heading}</h2>
              {items.length === 0 ? (
                <p className="text-meta text-muted-foreground">No {heading.toLowerCase()} tasks.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      overdue={overdue}
                      isAdmin={isAdmin}
                      isPending={completeMutation.isPending || deleteMutation.isPending}
                      onEdit={() => setEditingTask(task)}
                      onComplete={() => completeMutation.mutate(task)}
                      onDelete={() => deleteMutation.mutate(task.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          ))
        : null}
    </div>
  )
}

function TaskCard({
  task,
  overdue,
  isAdmin,
  isPending,
  onEdit,
  onComplete,
  onDelete,
}: {
  task: TaskItem
  overdue: boolean
  isAdmin: boolean
  isPending: boolean
  onEdit: () => void
  onComplete: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{task.title}</CardTitle>
          {isAdmin ? <p className="text-label text-muted-foreground">{task.owner.name}</p> : null}
        </div>
        {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
        {task.completedAt ? <Badge variant="secondary">Completed</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description ? <p className="whitespace-pre-wrap text-body">{task.description}</p> : null}
        <p className="text-label text-muted-foreground">
          {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleString()}` : "No due date"}
        </p>
        <div className="flex flex-wrap gap-3 text-meta">
          {task.ticket ? (
            <Link href={`/agent/tickets/${task.ticket.id}`} className="underline underline-offset-2">
              Ticket: {task.ticket.subject}
            </Link>
          ) : null}
          {task.customer ? (
            <Link href={`/agent/customers/${task.customer.id}`} className="underline underline-offset-2">
              Customer: {task.customer.name}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onEdit}>
            Edit
          </Button>
          {!task.completedAt ? (
            <Button type="button" size="sm" disabled={isPending} onClick={onComplete}>
              Complete
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
