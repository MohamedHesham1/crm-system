import { randomUUID } from "node:crypto"
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const STORAGE_ENV = "ATTACHMENT_STORAGE_DIR"

function getStorageDirectory(): string {
  const configured = process.env[STORAGE_ENV]
  if (!configured) throw new Error(`${STORAGE_ENV} must point to a persistent private directory.`)

  const directory = path.resolve(configured)
  const publicDirectory = path.resolve(process.cwd(), "public")
  const relative = path.relative(publicDirectory, directory)
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error(`${STORAGE_ENV} must be outside the public directory.`)
  }

  return directory
}

function validateStorageKey(storageKey: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageKey)) {
    throw new Error("Invalid opaque attachment storage key.")
  }
}

async function resolveStorageDirectory(): Promise<string> {
  const directory = getStorageDirectory()
  const publicDirectory = path.resolve(process.cwd(), "public")
  const [realDirectory, realPublicDirectory] = await Promise.all([
    realpath(directory),
    realpath(publicDirectory),
  ])
  const relative = path.relative(realPublicDirectory, realDirectory)
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error(`${STORAGE_ENV} resolves inside the public directory.`)
  }
  return realDirectory
}

export async function writeAttachmentBytes(bytes: Uint8Array): Promise<string> {
  const storageKey = randomUUID()
  const directory = getStorageDirectory()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const privateDirectory = await resolveStorageDirectory()
  await writeFile(path.join(privateDirectory, storageKey), bytes, { flag: "wx", mode: 0o600 })
  return storageKey
}

export async function readAttachmentBytes(storageKey: string): Promise<Buffer> {
  validateStorageKey(storageKey)
  const directory = await resolveStorageDirectory()
  return readFile(path.join(directory, storageKey))
}

export async function deleteAttachmentBytes(storageKey: string): Promise<void> {
  validateStorageKey(storageKey)
  const directory = await resolveStorageDirectory()
  await unlink(path.join(directory, storageKey))
}
