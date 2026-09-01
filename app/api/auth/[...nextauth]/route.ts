import { handlers } from "@/auth"

// The one route under `app/api/**` not wrapped in the guardrails auth
// declaration used everywhere else (see `lib/api/http.ts`): these handlers
// are Auth.js's own, and authentication is what they are for. The throttle
// for the credentials flow lives in `authorize()` (`auth.ts`), not here.
export const { GET, POST } = handlers
