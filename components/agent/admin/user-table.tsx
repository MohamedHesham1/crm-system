"use client"

import { useQuery } from "@tanstack/react-query"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchUsers, userKeys } from "@/lib/users"

export function UserTable() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: userKeys.list(),
    queryFn: fetchUsers,
  })

  if (isPending) return <p className="text-meta text-muted-foreground">Loading accounts…</p>

  if (isError) {
    return (
      <p role="alert" className="text-meta text-destructive">
        {error instanceof Error ? error.message : "Could not load accounts."}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell className="text-muted-foreground">{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
