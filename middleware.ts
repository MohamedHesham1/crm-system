import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/auth.config"
import { homeForRole, isStaff } from "@/lib/roles"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const user = req.auth?.user
  const path = nextUrl.pathname

  const isAuthPage = path === "/login" || path === "/register"
  const isAgentArea = path === "/agent" || path.startsWith("/agent/")
  const isPortalArea = path === "/portal" || path.startsWith("/portal/")

  if (!user) {
    if (isAgentArea || isPortalArea) {
      const url = new URL("/login", nextUrl)
      url.searchParams.set("callbackUrl", path)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  const home = homeForRole(user.role)

  if (isAuthPage) return NextResponse.redirect(new URL(home, nextUrl))
  if (isAgentArea && !isStaff(user.role)) return NextResponse.redirect(new URL(home, nextUrl))
  if (isPortalArea && user.role !== "CUSTOMER") return NextResponse.redirect(new URL(home, nextUrl))

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
