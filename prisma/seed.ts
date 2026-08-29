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

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", passwordHash, role: "CUSTOMER" },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      passwordHash,
      role: "CUSTOMER",
    },
  })

  // The seeded portal login gets a real linked profile via `Customer.userId` —
  // the same shape `registerCustomer` produces. No code path special-cases the
  // seed, so anything that works here works for a real registration.
  await prisma.customer.upsert({
    where: { email: "customer@crm.local" },
    update: { name: "Cody Customer", phone: "+1 555 0110", userId: customerUser.id },
    create: {
      name: "Cody Customer",
      email: "customer@crm.local",
      phone: "+1 555 0110",
      userId: customerUser.id,
    },
  })

  await prisma.user.upsert({
    where: { email: "admin@crm.local" },
    update: { name: "Adam Admin", passwordHash, role: "ADMIN" },
    create: {
      name: "Adam Admin",
      email: "admin@crm.local",
      passwordHash,
      role: "ADMIN",
    },
  })

  const CUSTOMERS = [
    {
      name: "Nadia Rahman",
      email: "nadia@northwind.example",
      phone: "+1 555 0142",
      company: "Northwind Traders",
      notes: "Prefers email over phone. Renewal due in Q3.",
    },
    {
      name: "Tom Okafor",
      email: "tom@lakeside.example",
      phone: "+1 555 0188",
      company: null,
      notes: "",
    },
    {
      name: "Priya Venkat",
      email: "priya@helio.example",
      phone: "+1 555 0201",
      company: "Helio Labs",
      notes: "Escalated billing issue in March; resolved.",
    },
  ]

  for (const customer of CUSTOMERS) {
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: customer,
      create: customer,
    })
  }

  console.log("Seeded users:")
  console.log(`  agent@crm.local    / ${SEED_PASSWORD}  (AGENT)`)
  console.log(`  customer@crm.local / ${SEED_PASSWORD}  (CUSTOMER)`)
  console.log(`  admin@crm.local    / ${SEED_PASSWORD}  (ADMIN)`)
  console.log(`Seeded ${CUSTOMERS.length} customers (unlinked) + 1 linked to customer@crm.local.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
