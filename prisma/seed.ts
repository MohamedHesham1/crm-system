import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const SEED_PASSWORD = "Passw0rd!"

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  await prisma.user.upsert({
    where: { email: "agent@crm.local" },
    update: { name: "Ava Agent", passwordHash, role: "AGENT" },
    create: {
      name: "Ava Agent",
      email: "agent@crm.local",
      passwordHash,
      role: "AGENT",
    },
  })

  await prisma.user.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", passwordHash, role: "CUSTOMER" },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      passwordHash,
      role: "CUSTOMER",
    },
  })

  console.log("Seeded users:")
  console.log(`  agent@crm.local    / ${SEED_PASSWORD}  (AGENT)`)
  console.log(`  customer@crm.local / ${SEED_PASSWORD}  (CUSTOMER)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
