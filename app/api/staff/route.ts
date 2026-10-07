import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/http"
import { isRole, isStaff } from "@/lib/roles"

export const GET = withAuth({ role: "agent" }, async () => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "ADMIN"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  })

  return Response.json({
    users: users.filter((user) => isRole(user.role) && isStaff(user.role)),
  })
})
