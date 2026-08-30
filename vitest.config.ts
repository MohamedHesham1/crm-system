import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

/**
 * Resolved **relative to `prisma/schema.prisma`**, exactly like the
 * `DATABASE_URL` in `.env` — so this is `prisma/test.db`, never the repo root.
 * `prisma/*.db` is already gitignored. `dotenv` does not override a variable
 * that is already set, so this value wins over `.env` in both the Prisma CLI
 * (task 3) and the client (`lib/prisma.ts:7`).
 */
export const TEST_DATABASE_URL = "file:./test.db"

export default defineConfig({
  resolve: {
    // The hand-written equivalent of `tsconfig.json`'s `paths` (lines 26–28).
    alias: { "@": root },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    // One SQLite file, one writer. Parallel workers produce SQLITE_BUSY, not
    // faster tests, on a suite this size.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias: { "@": root } },
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.ts"],
          setupFiles: ["./tests/setup/api.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
      {
        resolve: {
          alias: {
            "@": root,
            // `next/link` needs an App Router context that no test mounts.
            // A plain anchor is all four component tests need from it.
            "next/link": `${root}tests/stubs/next-link.tsx`,
          },
        },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["./tests/setup/dom.ts"],
        },
      },
    ],
  },
})
