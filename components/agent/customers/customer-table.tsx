"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { customerKeys, fetchCustomers } from "@/lib/customers"

export function CustomerTable() {
  const [page, setPage] = useState(1)

  const { data, isPending, isError, error } = useQuery({
    queryKey: customerKeys.list(page),
    queryFn: () => fetchCustomers(page),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <Spinner label="Loading customers…" />

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load customers."}
      </p>
    )
  }

  if (data.items.length === 0) {
    return <p className="text-meta text-muted-foreground">No customers yet. Create the first one.</p>
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((customer) => (
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

      {data.total > data.pageSize ? (
        <div className="flex items-center justify-between">
          <p className="text-meta text-muted-foreground">
            {`Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(
              data.page * data.pageSize,
              data.total,
            )} of ${data.total}`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
