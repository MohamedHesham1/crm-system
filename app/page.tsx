import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { homeForRole } from "@/lib/roles"

export default async function RootPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  redirect(homeForRole(session.user.role))
}
