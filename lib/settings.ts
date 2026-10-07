import type { TicketCategory as PrismaTicketCategory } from "@prisma/client"

import { request } from "@/lib/api/client"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_SLA_TARGETS,
  DEFAULT_TICKET_CATEGORY,
  type SlaTargetSetting,
} from "@/lib/validation/settings"
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/validation/ticket"

export type TicketCategoryItem = Pick<
  PrismaTicketCategory,
  "id" | "name" | "normalizedName" | "active" | "sortOrder"
>

export type SlaTargetItem = SlaTargetSetting

export type TicketSettings = {
  categories: TicketCategoryItem[]
  slaTargets: SlaTargetItem[]
}

export const ticketSettingsKeys = {
  all: ["ticket-settings"] as const,
  categories: () => ["ticket-categories"] as const,
}

export async function getTicketSettings(): Promise<TicketSettings> {
  const [storedCategories, storedTargets] = await Promise.all([
    prisma.ticketCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.slaTarget.findMany(),
  ])
  const categories = storedCategories.length
    ? storedCategories
    : [{ ...DEFAULT_TICKET_CATEGORY }]
  const targetsByPriority = new Map(storedTargets.map((target) => [target.priority, target]))
  const slaTargets = TICKET_PRIORITIES.map((priority) => {
    const target = targetsByPriority.get(priority) ?? DEFAULT_SLA_TARGETS[priority]
    return {
      priority,
      responseHours: target.responseHours,
      resolutionHours: target.resolutionHours,
    }
  })
  return { categories, slaTargets }
}

export async function getActiveTicketCategories(): Promise<TicketCategoryItem[]> {
  const categories = await prisma.ticketCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, normalizedName: true, active: true, sortOrder: true },
  })
  if (categories.length) return categories

  const anyStoredCategory = await prisma.ticketCategory.count()
  return anyStoredCategory ? [] : [{ ...DEFAULT_TICKET_CATEGORY }]
}

export async function getResolutionTargetHours(priority: TicketPriority): Promise<number> {
  const target = await prisma.slaTarget.findUnique({
    where: { priority },
    select: { resolutionHours: true },
  })
  return target?.resolutionHours ?? DEFAULT_SLA_TARGETS[priority].resolutionHours
}

export async function fetchAdminTicketSettings(): Promise<TicketSettings> {
  return request<TicketSettings>("/api/admin/settings")
}

export async function fetchTicketCategories(): Promise<TicketCategoryItem[]> {
  const { categories } = await request<{ categories: TicketCategoryItem[] }>("/api/ticket-categories")
  return categories
}

export async function createTicketCategory(name: string): Promise<TicketCategoryItem> {
  const { category } = await request<{ category: TicketCategoryItem }>("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
  return category
}

export async function updateTicketCategory(
  category: Pick<TicketCategoryItem, "id"> & Partial<Pick<TicketCategoryItem, "name" | "active" | "sortOrder">>,
): Promise<TicketCategoryItem> {
  const { category: updated } = await request<{ category: TicketCategoryItem }>(
    "/api/admin/settings",
    { method: "PATCH", body: JSON.stringify({ category }) },
  )
  return updated
}

export async function updateSlaTargets(slaTargets: SlaTargetSetting[]): Promise<SlaTargetItem[]> {
  const { slaTargets: updated } = await request<{ slaTargets: SlaTargetItem[] }>(
    "/api/admin/settings",
    { method: "PATCH", body: JSON.stringify({ slaTargets }) },
  )
  return updated
}
