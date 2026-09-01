"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, createCustomer, customerKeys, type FieldErrors } from "@/lib/customers"
import { createCustomerSchema } from "@/lib/validation/customer"

type Values = {
  name: string
  email: string
  phone: string
  company: string
  notes: string
}

const INITIAL_VALUES: Values = { name: "", email: "", phone: "", company: "", notes: "" }

export function CustomerForm() {
  const [values, setValues] = useState<Values>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: customerKeys.all })
      router.push(`/agent/customers/${customer.id}`)
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function handleChange(field: keyof Values) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = createCustomerSchema.safeParse(values)
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
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          value={values.phone}
          onChange={handleChange("phone")}
          aria-invalid={Boolean(fieldErrors.phone)}
        />
        {fieldErrors.phone ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.phone[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          value={values.company}
          onChange={handleChange("company")}
          aria-invalid={Boolean(fieldErrors.company)}
        />
        {fieldErrors.company ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.company[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          value={values.notes}
          onChange={handleChange("notes")}
          aria-invalid={Boolean(fieldErrors.notes)}
        />
        {fieldErrors.notes ? (
          <p role="alert" className="text-meta text-destructive">
            {fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-meta text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating…" : "Create customer"}
      </Button>
    </form>
  )
}
