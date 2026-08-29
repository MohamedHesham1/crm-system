import { z } from "zod"

/**
 * Trim and lowercase *before* the format check. `User.email` and
 * `Customer.email` are both `@unique` and SQLite compares text
 * case-sensitively, so normalisation has to happen here — not in a route
 * handler, and not in a form.
 */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
