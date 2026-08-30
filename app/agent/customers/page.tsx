import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CustomerTable } from "@/components/agent/customers/customer-table"

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display">Customers</h1>
        <Button asChild size="sm">
          <Link href="/agent/customers/new">New customer</Link>
        </Button>
      </div>
      <CustomerTable />
    </div>
  )
}
