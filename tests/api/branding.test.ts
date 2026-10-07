vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { mkdtemp, readdir, rm, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DELETE as removeLogo,
  GET as getBranding,
  PATCH as updateBranding,
  POST as uploadLogo,
} from "@/app/api/admin/branding/route"
import { GET as getPublicLogo } from "@/app/api/branding/logo/route"
import { brandColorContrast, foregroundForBrandColor } from "@/lib/validation/branding"
import { prisma } from "@/lib/prisma"
import { createUser } from "@/tests/helpers/factories"
import { jsonRequest } from "@/tests/helpers/request"

let storageDirectory = ""
let previousStorageDirectory: string | undefined

beforeEach(async () => {
  previousStorageDirectory = process.env.ATTACHMENT_STORAGE_DIR
  storageDirectory = await mkdtemp(path.join(tmpdir(), "crm-branding-"))
  process.env.ATTACHMENT_STORAGE_DIR = storageDirectory
})

afterEach(async () => {
  await rm(storageDirectory, { recursive: true, force: true })
  if (previousStorageDirectory === undefined) delete process.env.ATTACHMENT_STORAGE_DIR
  else process.env.ATTACHMENT_STORAGE_DIR = previousStorageDirectory
})

function uploadRequest(file: File): Request {
  const form = new FormData()
  form.append("file", file)
  return new Request("http://test/api/admin/branding", { method: "POST", body: form })
}

function pngFile(name = "brand.png"): File {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: "image/png" },
  )
}

describe("installation branding API", () => {
  it("returns shipped defaults, updates organization colors, and audits changes", async () => {
    const admin = await createUser("ADMIN")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const defaults = await getBranding(new Request("http://test/api/admin/branding"))
    expect(defaults.status).toBe(200)
    expect(await defaults.json()).toMatchObject({
      organizationName: "Meridian",
      primaryLight: "#086071",
      primaryDark: "#61bcc6",
      accentLight: "#e08829",
      accentDark: "#f1ab4a",
      logoAttachmentId: null,
      logoUrl: null,
    })

    const changed = await updateBranding(
      jsonRequest("http://test/api/admin/branding", "PATCH", {
        organizationName: "Northstar Support",
        primaryLight: "#123456",
        primaryDark: "#61bcc6",
        accentLight: "#e08829",
        accentDark: "#f1ab4a",
      }),
    )
    expect(changed.status).toBe(200)
    expect((await changed.json()).organizationName).toBe("Northstar Support")
    expect(await prisma.brandingSettings.count()).toBe(1)
    expect(
      await prisma.auditLog.count({
        where: { entityType: "BrandingSettings", actorId: admin.id, action: "SETTINGS_CHANGED" },
      }),
    ).toBe(1)
  })

  it("requires admin access and rejects malformed or low-contrast colors", async () => {
    const agent = await createUser("AGENT")
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    expect((await getBranding(new Request("http://test"))).status).toBe(403)
    expect(
      (
        await updateBranding(
          jsonRequest("http://test", "PATCH", { organizationName: "No Access" }),
        )
      ).status,
    ).toBe(403)

    const admin = await createUser("ADMIN")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const invalidHex = await updateBranding(
      jsonRequest("http://test", "PATCH", { primaryLight: "red; color: black" }),
    )
    expect(invalidHex.status).toBe(400)
    const unreadable = await updateBranding(
      jsonRequest("http://test", "PATCH", { primaryLight: "#777777" }),
    )
    expect(unreadable.status).toBe(400)
    expect((await unreadable.json()).fieldErrors.primaryLight).toBeDefined()
    expect(await prisma.brandingSettings.count()).toBe(0)
  })

  it("stores only verified raster images, serves logo publicly, then removes bytes and metadata", async () => {
    const admin = await createUser("ADMIN")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const invalid = await uploadLogo(uploadRequest(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })))
    expect(invalid.status).toBe(400)
    expect(await prisma.attachment.count()).toBe(0)

    const spoofed = await uploadLogo(uploadRequest(new File(["not an image"], "logo.png", { type: "image/png" })))
    expect(spoofed.status).toBe(400)
    expect(await prisma.attachment.count()).toBe(0)

    const uploaded = await uploadLogo(uploadRequest(pngFile()))
    expect(uploaded.status).toBe(201)
    const brand = await uploaded.json()
    expect(brand.logoAttachmentId).toBeTruthy()
    expect(brand.logoUrl).toBe("/api/branding/logo")

    signInAs(null)
    const logo = await getPublicLogo(new Request("http://test/api/branding/logo"))
    expect(logo.status).toBe(200)
    expect(logo.headers.get("content-type")).toBe("image/png")
    expect(logo.headers.get("x-content-type-options")).toBe("nosniff")
    expect(logo.headers.get("cache-control")).toBe("no-store")

    const stored = await prisma.attachment.findUniqueOrThrow({
      where: { id: brand.logoAttachmentId },
    })
    expect(await readdir(storageDirectory)).toEqual([stored.storageKey])
    await unlink(path.join(storageDirectory, stored.storageKey))
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    const brokenLogo = await getBranding(new Request("http://test/api/admin/branding"))
    expect((await brokenLogo.json()).logoAvailable).toBe(false)
    expect((await getPublicLogo(new Request("http://test/api/branding/logo"))).status).toBe(404)

    expect((await removeLogo(new Request("http://test/api/admin/branding", { method: "DELETE" }))).status).toBe(200)
    expect(await prisma.attachment.findUnique({ where: { id: stored.id } })).toBeNull()
    expect(await readdir(storageDirectory)).toEqual([])
  })
})

describe("brand color contrast helpers", () => {
  it("chooses text color with AA contrast and checks all four stored palette values", () => {
    for (const color of ["#086071", "#61bcc6", "#e08829", "#f1ab4a"]) {
      expect(brandColorContrast(color)).toBeGreaterThanOrEqual(4.5)
      expect(foregroundForBrandColor(color)).toMatch(/^#/)
    }
  })
})
