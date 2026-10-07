import { BrandingForm } from "@/components/agent/admin/branding-form"

export default function AdminBrandingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-meta text-muted-foreground">Installation-wide identity</p>
        <h1 className="text-display">Branding</h1>
      </header>
      <BrandingForm />
    </div>
  )
}
