export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type Pagination = { page: number; pageSize: number; skip: number; take: number }

/**
 * Offset pagination, not cursor: it maps onto the existing `findMany` calls
 * with a `skip`/`take` pair and nothing else. Every malformed input clamps to a
 * usable value — `?page=0`, `?page=-3`, `?pageSize=banana` and `?pageSize=9999`
 * all yield page 1 or a legal size rather than a 400, because a list endpoint
 * that 400s on a stale bookmark is worse than one that shows page 1.
 */
export function parsePagination(request: Request | undefined): Pagination {
  const params = request ? new URL(request.url).searchParams : new URLSearchParams()

  const rawPage = Number.parseInt(params.get("page") ?? "", 10)
  const rawSize = Number.parseInt(params.get("pageSize") ?? "", 10)

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(Math.max(rawSize, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}
