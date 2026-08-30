/** A `Request` with a JSON body, matching what `readJson` expects (`lib/api/http.ts:52–60`). */
export function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** The `ctx` a dynamic-segment handler awaits — `params` is a **Promise**. */
export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}
