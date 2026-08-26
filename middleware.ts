import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/auth.config"
import { homeForRole } from "@/lib/roles"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const user = req.auth?.user
  const path = nextUrl.pathname

  const isLogin = path === "/login"
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

  if (isLogin) return NextResponse.redirect(new URL(home, nextUrl))
  if (isAgentArea && user.role !== "AGENT") return NextResponse.redirect(new URL(home, nextUrl))
  if (isPortalArea && user.role !== "CUSTOMER") return NextResponse.redirect(new URL(home, nextUrl))

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
