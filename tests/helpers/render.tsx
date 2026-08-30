import type { ReactElement, ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"

/**
 * `app/providers.tsx` is deliberately **not** reused: it also mounts
 * `SessionProvider`, which would fetch `/api/auth/session`. `retry: false` is
 * the one setting that matters — the default three retries turn an expected
 * error state into a multi-second wait.
 */
export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) }
}
