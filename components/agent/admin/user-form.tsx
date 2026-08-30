"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, type FieldErrors } from "@/lib/api/client"
import { createUser, userKeys } from "@/lib/users"
import { CREATABLE_ROLES, createUserSchema } from "@/lib/validation/user"

type Values = { name: string; email: string; password: string; role: string }

const INITIAL_VALUES: Values = { name: "", email: "", password: "", role: "AGENT" }

export function UserForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.list() })
      router.push("/agent/admin/users")
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleChange(field: keyof Values) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = createUserSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors)
      return
    }

    setFieldErrors({})
    mutation.mutate(parsed.data)
  }

  const formError =
    mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length === 0
      ? mutation.error.message
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={values.name}
          onChange={handleChange("name")}
          aria-invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange("email")}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange("password")}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        {fieldErrors.password ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={values.role}
          onChange={(event) => setValues((prev) => ({ ...prev, role: event.target.value }))}
          aria-invalid={Boolean(fieldErrors.role)}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm"
        >
          {CREATABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {fieldErrors.role ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.role[0]}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-meta text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  )
}
