import Link from "next/link"

import { Button } from "@/components/ui/button"
import { UserTable } from "@/components/agent/admin/user-table"

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Button asChild size="sm">
          <Link href="/agent/admin/users/new">New account</Link>
        </Button>
      </div>
      <UserTable />
    </div>
  )
}
