import { request } from "@/lib/api/client"
import type { NotificationType } from "@/lib/validation/notification"

/**
 * `createdAt` is a `DateTime` in Prisma but arrives as an ISO **string** —
 * `Response.json` serialises it. Do not type it as `Date`.
 */
export type NotificationItem = {
  id: string
  type: NotificationType
  message: string
  relatedTicketId: string | null
  read: boolean
  createdAt: string
}

export type NotificationFeed = {
  notifications: NotificationItem[]
  unreadCount: number
}

export const notificationKeys = {
  all: ["notifications"] as const,
  feed: () => [...notificationKeys.all, "feed"] as const,
}

export async function fetchNotifications(): Promise<NotificationFeed> {
  return request<NotificationFeed>("/api/notifications")
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await request<{ ok: true }>(`/api/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  })
}
