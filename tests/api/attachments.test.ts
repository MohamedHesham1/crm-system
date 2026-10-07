vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  GET as getCustomerAttachments,
  POST as postCustomerAttachment,
} from "@/app/api/customers/[id]/attachments/route"
import {
  DELETE as deleteCustomerAttachment,
  GET as getCustomerAttachment,
} from "@/app/api/customers/[id]/attachments/[attachmentId]/route"
import {
  GET as getTicketAttachments,
  POST as postTicketAttachment,
} from "@/app/api/tickets/[id]/attachments/route"
import {
  DELETE as deleteTicketAttachment,
  GET as getTicketAttachment,
} from "@/app/api/tickets/[id]/attachments/[attachmentId]/route"
import { prisma } from "@/lib/prisma"
import { MAX_ATTACHMENT_SIZE } from "@/lib/attachments"
import { createCustomer, createTicket, createUser } from "@/tests/helpers/factories"
import { routeContext } from "@/tests/helpers/request"

let storageDirectory = ""
let previousStorageDirectory: string | undefined

beforeEach(async () => {
  previousStorageDirectory = process.env.ATTACHMENT_STORAGE_DIR
  storageDirectory = await mkdtemp(path.join(tmpdir(), "crm-attachments-"))
  process.env.ATTACHMENT_STORAGE_DIR = storageDirectory
})

afterEach(async () => {
  await rm(storageDirectory, { recursive: true, force: true })
  if (previousStorageDirectory === undefined) delete process.env.ATTACHMENT_STORAGE_DIR
  else process.env.ATTACHMENT_STORAGE_DIR = previousStorageDirectory
})

function uploadRequest(url: string, file: File): Request {
  const form = new FormData()
  form.append("file", file)
  return new Request(url, { method: "POST", body: form })
}

function textFile(name = "details.txt", text = "UTF-8 support details."): File {
  return new File([text], name, { type: "text/plain" })
}

describe("attachment APIs", () => {
  it("stores, lists, downloads, and deletes an authorized ticket attachment", async () => {
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })

    const upload = await postTicketAttachment(
      uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, textFile()),
      routeContext({ id: ticket.id }),
    )
    expect(upload.status).toBe(201)
    const { attachment } = await upload.json()
    expect(attachment.originalName).toBe("details.txt")
    expect(attachment.contentType).toBe("text/plain")
    expect(attachment.uploader.id).toBe(agent.id)
    expect(JSON.stringify(attachment)).not.toContain(storageDirectory)

    const rows = await getTicketAttachments(
      new Request(`http://test/api/tickets/${ticket.id}/attachments`),
      routeContext({ id: ticket.id }),
    )
    expect((await rows.json()).attachments).toHaveLength(1)

    const download = await getTicketAttachment(
      new Request(`http://test/api/tickets/${ticket.id}/attachments/${attachment.id}`),
      routeContext({ id: ticket.id, attachmentId: attachment.id }),
    )
    expect(download.status).toBe(200)
    expect(await download.text()).toBe("UTF-8 support details.")
    expect(download.headers.get("content-disposition")).toContain("attachment;")
    expect(download.headers.get("x-content-type-options")).toBe("nosniff")
    expect(download.headers.get("cache-control")).toBe("private, no-store")

    const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: attachment.id } })
    const filePath = path.join(storageDirectory, stored.storageKey)
    await stat(filePath)
    const deletion = await deleteTicketAttachment(
      new Request("http://test", { method: "DELETE" }),
      routeContext({ id: ticket.id, attachmentId: attachment.id }),
    )
    expect(deletion.status).toBe(200)
    expect(await prisma.attachment.findUnique({ where: { id: attachment.id } })).toBeNull()
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" })
    expect(await readdir(storageDirectory)).toEqual([])
  })

  it("scopes ticket attachments to ticket owners and limits customer deletion", async () => {
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const otherCustomerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    const otherCustomer = await createCustomer({ userId: otherCustomerUser.id })
    const ticket = await createTicket({ customerId: customer.id })
    const otherTicket = await createTicket({ customerId: otherCustomer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const upload = await postTicketAttachment(
      uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, textFile()),
      routeContext({ id: ticket.id }),
    )
    const { attachment } = await upload.json()

    signInAs({ id: otherCustomerUser.id, name: otherCustomerUser.name, role: "CUSTOMER" })
    const denied = await getTicketAttachment(
      new Request("http://test"),
      routeContext({ id: ticket.id, attachmentId: attachment.id }),
    )
    const missingOwner = await getTicketAttachments(
      new Request("http://test"),
      routeContext({ id: ticket.id }),
    )
    expect(denied.status).toBe(404)
    expect(missingOwner.status).toBe(404)
    const wrongTicket = await getTicketAttachment(
      new Request("http://test"),
      routeContext({ id: otherTicket.id, attachmentId: attachment.id }),
    )
    expect(wrongTicket.status).toBe(404)

    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    const deleteOtherUpload = await deleteTicketAttachment(
      new Request("http://test", { method: "DELETE" }),
      routeContext({ id: ticket.id, attachmentId: attachment.id }),
    )
    expect(deleteOtherUpload.status).toBe(404)

    const ownUpload = await postTicketAttachment(
      uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, textFile("own.txt")),
      routeContext({ id: ticket.id }),
    )
    expect(ownUpload.status).toBe(201)
    const ownAttachment = (await ownUpload.json()).attachment
    const ownDelete = await deleteTicketAttachment(
      new Request("http://test", { method: "DELETE" }),
      routeContext({ id: ticket.id, attachmentId: ownAttachment.id }),
    )
    expect(ownDelete.status).toBe(200)
  })

  it("allows staff-only customer-profile attachment management", async () => {
    const agent = await createUser("AGENT")
    const customerUser = await createUser("CUSTOMER")
    const customer = await createCustomer({ userId: customerUser.id })
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    expect(
      (
        await getCustomerAttachments(
          new Request("http://test"),
          routeContext({ id: customer.id }),
        )
      ).status,
    ).toBe(403)

    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const upload = await postCustomerAttachment(
      uploadRequest(`http://test/api/customers/${customer.id}/attachments`, textFile("profile.txt")),
      routeContext({ id: customer.id }),
    )
    expect(upload.status).toBe(201)
    const { attachment } = await upload.json()
    const download = await getCustomerAttachment(
      new Request("http://test"),
      routeContext({ id: customer.id, attachmentId: attachment.id }),
    )
    expect(await download.text()).toBe("UTF-8 support details.")
    const removal = await deleteCustomerAttachment(
      new Request("http://test", { method: "DELETE" }),
      routeContext({ id: customer.id, attachmentId: attachment.id }),
    )
    expect(removal.status).toBe(200)
  })

  it("rejects disallowed, mismatched, oversized, and markup files", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    const invalid = [
      textFile("page.html", "<html>bad</html>"),
      textFile("script.txt", "<script>alert(1)</script>"),
      new File(["not a png"], "image.png", { type: "image/png" }),
      new File([new Uint8Array(MAX_ATTACHMENT_SIZE + 1)], "large.txt", { type: "text/plain" }),
    ]

    for (const file of invalid) {
      const response = await postTicketAttachment(
        uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, file),
        routeContext({ id: ticket.id }),
      )
      expect(response.status).toBe(400)
    }
    expect(await prisma.attachment.count()).toBe(0)
    expect(await readdir(storageDirectory)).toEqual([])
  })

  it("removes stored bytes when metadata persistence fails", async () => {
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: "missing-uploader", name: "Missing", role: "AGENT" })

    const response = await postTicketAttachment(
      uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, textFile()),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(500)
    expect((await response.json()).error).toContain("attachment operation")
    expect(await prisma.attachment.count()).toBe(0)
    expect(await readdir(storageDirectory)).toEqual([])
  })

  it("never stores uploaded files under the public directory", async () => {
    const agent = await createUser("AGENT")
    const customer = await createCustomer()
    const ticket = await createTicket({ customerId: customer.id })
    signInAs({ id: agent.id, name: agent.name, role: "AGENT" })
    process.env.ATTACHMENT_STORAGE_DIR = path.join(process.cwd(), "public", "uploads")

    const response = await postTicketAttachment(
      uploadRequest(`http://test/api/tickets/${ticket.id}/attachments`, textFile()),
      routeContext({ id: ticket.id }),
    )
    expect(response.status).toBe(500)
    expect(await prisma.attachment.count()).toBe(0)
    expect(await stat(path.join(process.cwd(), "public", "uploads")).catch(() => null)).toBeNull()
  })
})
