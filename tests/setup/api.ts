import { afterAll, beforeEach } from "vitest"

import { prisma } from "@/lib/prisma"
import { resetRateLimits } from "@/lib/rate-limit"
import { resetDb } from "@/tests/helpers/db"
import { signInAs } from "@/tests/mocks/auth"

beforeEach(async () => {
  signInAs(null)
  resetRateLimits()
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})
