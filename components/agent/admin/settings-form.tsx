"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import {
  createTicketCategory,
  fetchAdminTicketSettings,
  ticketSettingsKeys,
  updateSlaTargets,
  updateTicketCategory,
  type SlaTargetItem,
  type TicketCategoryItem,
} from "@/lib/settings"
import { DEFAULT_SLA_TARGETS, updateTicketSettingsSchema } from "@/lib/validation/settings"
import type { TicketPriority } from "@/lib/validation/ticket"

export function SettingsForm() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ticketSettingsKeys.all, queryFn: fetchAdminTicketSettings })

  const invalidate = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketSettingsKeys.all }),
      queryClient.invalidateQueries({ queryKey: ticketSettingsKeys.categories() }),
    ])

  const createMutation = useMutation({
    mutationFn: createTicketCategory,
    onSuccess: invalidate,
  })
  const categoryMutation = useMutation({
    mutationFn: updateTicketCategory,
    onSuccess: invalidate,
  })
  const targetMutation = useMutation({
    mutationFn: updateSlaTargets,
    onSuccess: invalidate,
  })

  if (query.isPending) return <Spinner label="Loading ticket settings…" />
  if (query.isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {query.error instanceof Error ? query.error.message : "Could not load ticket settings."}
      </p>
    )
  }

  const mutationError =
    createMutation.error ?? categoryMutation.error ?? targetMutation.error
  const fieldErrors = mutationError instanceof ApiError ? mutationError.fieldErrors : {}
  const formError =
    mutationError instanceof Error && Object.keys(fieldErrors).length === 0
      ? mutationError.message
      : null

  return (
    <div className="space-y-6">
      {formError ? (
        <p role="alert" className="text-meta text-destructive">{formError}</p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ticket categories</CardTitle>
          <CardDescription>
            Inactive categories stay on historical tickets but cannot be selected for new ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldErrors.name?.[0] ? (
            <p role="alert" className="text-meta text-destructive">{fieldErrors.name[0]}</p>
          ) : null}
          <CategoryCreator
            disabled={createMutation.isPending}
            onCreate={(name) => createMutation.mutate(name)}
          />
          <div className="divide-y rounded-lg border">
            {query.data.categories.map((category) => (
              <CategoryRow
                key={`${category.id}:${category.name}:${category.sortOrder}`}
                category={category}
                disabled={categoryMutation.isPending}
                fieldErrors={
                  categoryMutation.variables?.id === category.id ? fieldErrors : {}
                }
                onSave={(change) => categoryMutation.mutate({ id: category.id, ...change })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <TargetEditor
        targets={query.data.slaTargets}
        disabled={targetMutation.isPending}
        errors={fieldErrors}
        onSave={(targets) => targetMutation.mutate(targets)}
      />
    </div>
  )
}

function CategoryCreator({
  disabled,
  onCreate,
}: {
  disabled: boolean
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState("")
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        if (name.trim()) {
          onCreate(name)
          setName("")
        }
      }}
    >
      <Label htmlFor="new-category" className="sr-only">New category name</Label>
      <Input
        id="new-category"
        placeholder="Add a category"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
      />
      <Button type="submit" variant="outline" disabled={disabled || !name.trim()}>
        Add category
      </Button>
    </form>
  )
}

function CategoryRow({
  category,
  disabled,
  fieldErrors,
  onSave,
}: {
  category: TicketCategoryItem
  disabled: boolean
  fieldErrors: Record<string, string[] | undefined>
  onSave: (change: { name: string; sortOrder: number; active: boolean }) => void
}) {
  const [name, setName] = useState(category.name)
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder))

  return (
    <form
      className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-center"
      onSubmit={(event) => {
        event.preventDefault()
        const order = Number(sortOrder)
        if (Number.isInteger(order) && order >= 0 && order <= 10_000) {
          onSave({ name, sortOrder: order, active: category.active })
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`category-${category.id}`} className="sr-only">Category name</Label>
        <Input
          id={`category-${category.id}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          aria-invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name?.[0] ? (
          <p role="alert" className="text-meta text-destructive">{fieldErrors.name[0]}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`order-${category.id}`} className="sr-only">Display order</Label>
        <Input
          id={`order-${category.id}`}
          aria-label={`${category.name} display order`}
          type="number"
          min={0}
          max={10_000}
          step={1}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          aria-invalid={Boolean(fieldErrors.sortOrder)}
        />
        {fieldErrors.sortOrder?.[0] ? (
          <p role="alert" className="text-meta text-destructive">{fieldErrors.sortOrder[0]}</p>
        ) : null}
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={disabled}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant={category.active ? "ghost" : "secondary"}
        disabled={disabled}
        onClick={() =>
          onSave({ name, sortOrder: Number(sortOrder), active: !category.active })
        }
      >
        {category.active ? "Deactivate" : "Activate"}
      </Button>
    </form>
  )
}

function TargetEditor({
  targets,
  disabled,
  errors,
  onSave,
}: {
  targets: SlaTargetItem[]
  disabled: boolean
  errors: Record<string, string[] | undefined>
  onSave: (targets: SlaTargetItem[]) => void
}) {
  const [values, setValues] = useState<SlaTargetItem[]>(targets)
  const [formErrors, setFormErrors] = useState<Record<string, string[] | undefined>>({})

  function change(priority: TicketPriority, field: "responseHours" | "resolutionHours", value: string) {
    const hours = value === "" ? Number.NaN : Number(value)
    setValues((current) =>
      current.map((target) =>
        target.priority === priority ? { ...target, [field]: hours } : target,
      ),
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = updateTicketSettingsSchema.safeParse({ slaTargets: values })
    if (!parsed.success) {
      setFormErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }
    setFormErrors({})
    if ("slaTargets" in parsed.data) onSave(parsed.data.slaTargets)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA targets</CardTitle>
        <CardDescription>
          Response targets are stored for configuration. On-time reports and ticket deadlines measure resolution targets only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-surface-sunken text-left text-label uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Priority</th>
                  <th className="p-3">First response (hours)</th>
                  <th className="p-3">Resolution (hours)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {values.map((target) => (
                  <tr key={target.priority}>
                    <th className="p-3 text-left font-medium">{target.priority}</th>
                    <td className="p-3">
                      <TargetInput
                        priority={target.priority}
                        label="first response"
                        value={target.responseHours}
                        onChange={(value) => change(target.priority, "responseHours", value)}
                      />
                    </td>
                    <td className="p-3">
                      <TargetInput
                        priority={target.priority}
                        label="resolution"
                        value={target.resolutionHours}
                        onChange={(value) => change(target.priority, "resolutionHours", value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(formErrors.slaTargets?.[0] ?? errors.slaTargets?.[0]) ? (
            <p role="alert" className="text-meta text-destructive">
              {formErrors.slaTargets?.[0] ?? errors.slaTargets?.[0]}
            </p>
          ) : null}
          <Button type="submit" disabled={disabled}>
            {disabled ? "Saving targets…" : "Save SLA targets"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TargetInput({
  priority,
  label,
  value,
  onChange,
}: {
  priority: TicketPriority
  label: string
  value: number
  onChange: (value: string) => void
}) {
  const name = `${priority} ${label} target`
  const fallback = DEFAULT_SLA_TARGETS[priority][label === "resolution" ? "resolutionHours" : "responseHours"]
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="sr-only">{name}</Label>
      <Input
        id={name}
        aria-label={name}
        type="number"
        min={1}
        max={8_760}
        step={1}
        value={Number.isNaN(value) ? "" : value}
        placeholder={String(fallback)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
