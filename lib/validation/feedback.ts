import { z } from "zod"

/**
 * The rating bounds live here and nowhere else, for the same reason
 * `TICKET_STATUSES` does (`lib/validation/ticket.ts:3–7`): SQLite constrains
 * nothing, so application code is the constraint. The UI renders its buttons
 * from `RATING_VALUES` rather than from a literal `[1, 2, 3, 4, 5]`.
 */
export const RATING_MIN = 1
export const RATING_MAX = 5
export const RATING_VALUES = [1, 2, 3, 4, 5] as const

export const createFeedbackSchema = z.object({
  rating: z
    .number()
    .int("Choose a whole-number rating.")
    .min(RATING_MIN, "Rating must be between 1 and 5.")
    .max(RATING_MAX, "Rating must be between 1 and 5."),
  /**
   * Optional and trimmed. The route stores `""` as `null` — a row whose comment
   * is an empty string and a row with no comment must not be two states.
   */
  comment: z
    .string()
    .trim()
    .max(2_000, "Comment must be 2,000 characters or fewer.")
    .optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
