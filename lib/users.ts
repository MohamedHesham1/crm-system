import type { CreateUserInput } from "@/lib/validation/user"
import { request } from "@/lib/api/client"
import type { Role } from "@/lib/roles"

/**
 * `createdAt` is a `Date` in Prisma but arrives as an ISO **string** —
 * `Response.json` serialises it. Do not type it as `Date`.
 */
export type UserListItem = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const { users } = await request<{ users: UserListItem[] }>("/api/admin/users")
  return users
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const { user } = await request<{ user: UserListItem }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return user
}
