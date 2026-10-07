import { request } from "@/lib/api/client"
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task"

export type TaskItem = {
  id: string
  title: string
  description: string | null
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  owner: { id: string; name: string }
  ticket: { id: string; subject: string } | null
  customer: { id: string; name: string } | null
}

export type TaskLists = {
  upcoming: TaskItem[]
  overdue: TaskItem[]
  completed: TaskItem[]
}

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (ownerId?: string) => [...taskKeys.lists(), ownerId ?? "default"] as const,
  detail: (id: string) => [...taskKeys.all, "detail", id] as const,
}

export async function fetchTasks(ownerId?: string): Promise<TaskLists> {
  const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ""
  return request<TaskLists>(`/api/tasks${query}`)
}

export async function createTask(input: CreateTaskInput): Promise<TaskItem> {
  const { task } = await request<{ task: TaskItem }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return task
}

export async function updateTask(
  id: string,
  input: CreateTaskInput | UpdateTaskInput,
): Promise<TaskItem> {
  const { task } = await request<{ task: TaskItem }>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return task
}

export async function deleteTask(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })
}
