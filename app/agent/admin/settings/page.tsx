import { SettingsForm } from "@/components/agent/admin/settings-form"

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-meta text-muted-foreground">Ticket handling defaults</p>
        <h1 className="text-display">System settings</h1>
      </header>
      <SettingsForm />
    </div>
  )
}
