"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { customerKeys, fetchCustomer, updateCustomer } from "@/lib/customers"

export function CustomerProfile({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient()

  const { data, isPending, isError, error } = useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: () => fetchCustomer(customerId),
  })

  const [notes, setNotes] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (nextNotes: string) => updateCustomer(customerId, { notes: nextNotes }),
    onSuccess: async (customer) => {
      setNotes(null)
      queryClient.setQueryData(customerKeys.detail(customerId), customer)
      await queryClient.invalidateQueries({ queryKey: customerKeys.list() })
    },
  })

  if (isPending) return <p className="text-sm text-muted-foreground">Loading customer…</p>

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load customer."}
      </p>
    )
  }

  const value = notes ?? data.notes
  const isDirty = value !== data.notes

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/agent/customers" className="text-sm text-muted-foreground hover:underline">
        ← All customers
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-muted-foreground">{data.email}</p>
        <p className="text-sm text-muted-foreground">{data.phone}</p>
        <p className="text-sm text-muted-foreground">{data.company ?? "—"}</p>
        <p className="text-sm text-muted-foreground">
          Added {new Date(data.createdAt).toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={8}
            value={value}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || mutation.isPending}
              onClick={() => mutation.mutate(value)}
            >
              {mutation.isPending ? "Saving…" : "Save notes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isDirty}
              onClick={() => setNotes(null)}
            >
              Discard
            </Button>
          </div>
          {mutation.isSuccess && !isDirty ? (
            <p className="text-sm text-muted-foreground">Notes saved.</p>
          ) : null}
          {mutation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error instanceof Error ? mutation.error.message : "Could not save notes."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
