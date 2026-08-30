"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerKeys, fetchCustomers } from "@/lib/customers"

export function CustomerTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: customerKeys.list(),
    queryFn: fetchCustomers,
  })

  if (isPending) return <p className="text-meta text-muted-foreground">Loading customers…</p>

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load customers."}
      </p>
    )
  }

  if (data.length === 0) {
    return <p className="text-meta text-muted-foreground">No customers yet. Create the first one.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <Link href={`/agent/customers/${customer.id}`} className="font-medium hover:underline">
                {customer.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{customer.email}</TableCell>
            <TableCell className="text-muted-foreground">{customer.phone}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
