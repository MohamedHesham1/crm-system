export const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
  ticket: { select: { id: true, subject: true } },
  customer: { select: { id: true, name: true } },
} as const
