"use client"

import { useState } from "react"
import Link from "next/link"
import { BellIcon } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchNotifications, markNotificationRead, notificationKeys } from "@/lib/notifications"

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: notificationKeys.feed(),
    queryFn: fetchNotifications,
    // Polling, not push — WebSockets and SSE are explicitly out of scope.
    // 30 s, against the comment thread's 8 s
    // (`components/agent/tickets/comment-thread.tsx:29`): a bell is ambient, a
    // thread you are staring at is not. `staleTime: 0` overrides the
    // provider-wide 30 s (`app/providers.tsx:12`) so the first mount after a
    // navigation is fresh. `refetchIntervalInBackground` is **left at its
    // default `false`** — a pinned tab must not poll all night.
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <BellIcon />
          <span>Notifications</span>
          {unreadCount > 0 ? (
            <Badge variant="destructive" className="ml-auto">
              {unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={markRead.isPending}
              onClick={() => {
                for (const item of notifications) {
                  if (!item.read) markRead.mutate(item.id)
                }
              }}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Nothing new.</p>
          ) : (
            notifications.map((item) => {
              const body = (
                <div className={item.read ? "opacity-60" : undefined}>
                  <p className="text-sm">{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              )

              return (
                <div key={item.id} className="border-b px-3 py-2 last:border-b-0">
                  {item.relatedTicketId ? (
                    <Link
                      href={`/agent/tickets/${item.relatedTicketId}`}
                      onClick={() => {
                        if (!item.read) markRead.mutate(item.id)
                        setOpen(false)
                      }}
                      className="block hover:underline"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
