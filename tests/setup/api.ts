import { afterAll, beforeEach } from "vitest"

import { prisma } from "@/lib/prisma"
import { resetDb } from "@/tests/helpers/db"
import { signInAs } from "@/tests/mocks/auth"

beforeEach(async () => {
  signInAs(null)
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})
