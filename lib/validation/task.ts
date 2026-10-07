import { z } from "zod"

const title = z
  .string()
  .trim()
  .min(1, "Task title is required.")
  .max(200, "Task title must be 200 characters or fewer.")

const description = z
  .string()
  .trim()
  .max(2_000, "Description must be 2,000 characters or fewer.")
  .optional()

const dueAt = z.iso.datetime({ message: "Enter a valid due date and time." }).nullable().optional()
const linkedId = z.string().min(1).nullable().optional()

export const createTaskSchema = z.object({
  title,
  description,
  dueAt,
  ticketId: linkedId,
  customerId: linkedId,
  ownerId: z.string().min(1).optional(),
})

export const updateTaskSchema = z.object({
  title: title.optional(),
  description,
  dueAt,
  ticketId: linkedId,
  customerId: linkedId,
  ownerId: z.string().min(1).optional(),
  completed: z.boolean().optional(),
})

export type CreateTaskInput = z.input<typeof createTaskSchema>
export type UpdateTaskInput = z.input<typeof updateTaskSchema>
