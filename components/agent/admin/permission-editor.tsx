"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  fetchUserPermissions,
  resetUserPermission,
  setUserPermission,
  userPermissionKeys,
} from "@/lib/permissions-client"
import type { Permission } from "@/lib/permission-catalog"
import { Spinner } from "@/components/ui/spinner"

export function PermissionEditor({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const queryKey = userPermissionKeys.detail(userId)
  const { data, isPending, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchUserPermissions(userId),
    enabled: open,
  })
  const mutation = useMutation({
    mutationFn: (change: { permission: Permission; granted: boolean }) =>
      setUserPermission(userId, change),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  const resetMutation = useMutation({
    mutationFn: (permission: Permission) => resetUserPermission(userId, permission),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return (
    <section className="space-y-3">
      <button
        type="button"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide permissions" : "Manage permissions"}
      </button>

      {open ? (
        <div className="min-w-64 space-y-3 rounded-md border p-3">
          {isPending ? <Spinner label="Loading permissions…" /> : null}
          {isError ? (
            <p role="alert" className="text-meta text-destructive">
              {error instanceof Error ? error.message : "Could not load permissions."}
            </p>
          ) : null}
          {mutation.isError || resetMutation.isError ? (
            <p role="alert" className="text-meta text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : resetMutation.error instanceof Error
                  ? resetMutation.error.message
                  : "Could not update permissions."}
            </p>
          ) : null}
          {data?.map((setting) => (
            <div key={setting.permission} className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={setting.effectiveGranted}
                  disabled={mutation.isPending || resetMutation.isPending}
                  onChange={(event) =>
                    mutation.mutate({
                      permission: setting.permission,
                      granted: event.currentTarget.checked,
                    })
                  }
                />
                {setting.label}
              </label>
              {setting.overridden ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  disabled={mutation.isPending || resetMutation.isPending}
                  onClick={() => resetMutation.mutate(setting.permission)}
                >
                  Reset
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Default</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
