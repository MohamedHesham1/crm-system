import { AuditTable } from "@/components/agent/admin/audit-table"

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit trail</h1>
      <AuditTable />
    </div>
  )
}
