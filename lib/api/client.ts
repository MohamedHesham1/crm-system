export type FieldErrors = Record<string, string[] | undefined>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** Shared by every client data module. Throws `ApiError` on a non-2xx response. */
export async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: string } | null)?.error ?? "Request failed.",
      response.status,
      (payload as { fieldErrors?: FieldErrors } | null)?.fieldErrors ?? {},
    )
  }

  return payload as T
}
