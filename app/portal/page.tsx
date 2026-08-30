import { auth } from "@/auth"

export default async function PortalHomePage() {
  const session = await auth()

  return (
    <div className="space-y-2">
      <h1 className="text-display">Welcome, {session?.user.name}</h1>
      <p className="text-meta text-muted-foreground">Your requests and updates will appear here.</p>
    </div>
  )
}
