import { execFileSync } from "node:child_process"

import { TEST_DATABASE_URL } from "../vitest.config"

/**
 * Runs **once**, before any worker starts. `db push --force-reset` drops and
 * recreates `prisma/test.db` from `schema.prisma` — deliberately not
 * `migrate deploy`: the suite tests the current schema, not migration history,
 * and a reset is the only way to guarantee a clean file after a crashed run.
 */
export default function setup() {
  execFileSync("npx", ["prisma", "db", "push", "--force-reset", "--skip-generate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  })
}
