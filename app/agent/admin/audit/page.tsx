import { AuditTable } from "@/components/agent/admin/audit-table"

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-display">Audit trail</h1>
      <AuditTable />
    </div>
  )
}
