vi.mock("@/auth", () => import("@/tests/mocks/auth"))
import { signInAs } from "@/tests/mocks/auth"

import { describe, expect, it, vi } from "vitest"

import { GET as getAdminArticles, POST as createArticle } from "@/app/api/admin/articles/route"
import {
  DELETE as archiveArticle,
  GET as getAdminArticle,
  PATCH as updateArticle,
} from "@/app/api/admin/articles/[id]/route"
import { GET as getKnowledgeArticle } from "@/app/api/knowledge-base/[slug]/route"
import { GET as searchKnowledgeBase } from "@/app/api/knowledge-base/route"
import { prisma } from "@/lib/prisma"
import { createCustomer, createUser } from "@/tests/helpers/factories"
import { jsonRequest, routeContext } from "@/tests/helpers/request"

const validArticle = {
  title: "Invoice reconciliation",
  slug: "invoice-reconciliation",
  summary: "Find and match recent invoices.",
  body: "Use the account ledger to reconcile each payment.",
  category: "Billing",
}

describe("knowledge articles API", () => {
  it("allows admins to author, edit, publish, unpublish, and archive articles", async () => {
    const admin = await createUser("ADMIN")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const created = await createArticle(jsonRequest("http://test/api/admin/articles", "POST", validArticle))
    expect(created.status).toBe(201)
    const draft = (await created.json()).article
    expect(draft.status).toBe("DRAFT")
    expect(draft.publishedAt).toBeNull()
    expect(draft.author.id).toBe(admin.id)

    const adminList = await getAdminArticles(new Request("http://test/api/admin/articles"))
    expect((await adminList.json()).articles.map((item: { id: string }) => item.id)).toContain(draft.id)

    const publishedResponse = await updateArticle(
      jsonRequest("http://test", "PATCH", { status: "PUBLISHED", summary: "Updated invoice steps." }),
      routeContext({ id: draft.id }),
    )
    expect(publishedResponse.status).toBe(200)
    const published = (await publishedResponse.json()).article
    expect(published.status).toBe("PUBLISHED")
    expect(published.publishedAt).not.toBeNull()

    const edited = await updateArticle(
      jsonRequest("http://test", "PATCH", { title: "Invoice guide" }),
      routeContext({ id: draft.id }),
    )
    expect((await edited.json()).article.title).toBe("Invoice guide")

    const unpublished = await updateArticle(
      jsonRequest("http://test", "PATCH", { status: "DRAFT" }),
      routeContext({ id: draft.id }),
    )
    expect((await unpublished.json()).article.publishedAt).toBeNull()

    const archived = await archiveArticle(
      new Request("http://test", { method: "DELETE" }),
      routeContext({ id: draft.id }),
    )
    expect(archived.status).toBe(200)
    expect((await prisma.knowledgeArticle.findUnique({ where: { id: draft.id } }))?.status).toBe(
      "ARCHIVED",
    )

    const adminDetail = await getAdminArticle(
      new Request("http://test"),
      routeContext({ id: draft.id }),
    )
    expect((await adminDetail.json()).article.status).toBe("ARCHIVED")
  })

  it("constrains customer search and detail to published articles", async () => {
    const admin = await createUser("ADMIN")
    const customerUser = await createUser("CUSTOMER")
    await createCustomer({ userId: customerUser.id })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const draftResponse = await createArticle(
      jsonRequest("http://test/api/admin/articles", "POST", validArticle),
    )
    const draft = (await draftResponse.json()).article
    const publishedResponse = await updateArticle(
      jsonRequest("http://test", "PATCH", { status: "PUBLISHED" }),
      routeContext({ id: draft.id }),
    )
    expect(publishedResponse.status).toBe(200)

    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    const publicList = await searchKnowledgeBase(new Request("http://test/api/knowledge-base"))
    const list = await publicList.json()
    expect(list.articles.map((article: { slug: string }) => article.slug)).toEqual([
      "invoice-reconciliation",
    ])
    expect(list.articles[0]).not.toHaveProperty("body")

    const visible = await getKnowledgeArticle(
      new Request("http://test"),
      routeContext({ slug: draft.slug }),
    )
    expect(visible.status).toBe(200)
    const publicArticle = (await visible.json()).article
    expect(publicArticle.body).toContain("account ledger")
    expect(publicArticle).not.toHaveProperty("author")

    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    await updateArticle(
      jsonRequest("http://test", "PATCH", { status: "DRAFT" }),
      routeContext({ id: draft.id }),
    )
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    expect(
      (
        await getKnowledgeArticle(
          new Request("http://test"),
          routeContext({ slug: draft.slug }),
        )
      ).status,
    ).toBe(404)
    const noMatches = await searchKnowledgeBase(
      new Request("http://test/api/knowledge-base?q=invoice"),
    )
    expect(noMatches.status).toBe(200)
    expect((await noMatches.json()).total).toBe(0)
  })

  it("searches title, summary, body, and category with bounded pagination", async () => {
    const admin = await createUser("ADMIN")
    const customerUser = await createUser("CUSTOMER")
    await createCustomer({ userId: customerUser.id })
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })

    const articles = Array.from({ length: 16 }, (_, index) => {
      const needle =
        ["title-match", "summary-match", "body-match", "category-match"][index] ?? ""
      return {
        ...validArticle,
        id: `article-${index}`,
        slug: `article-${index}`,
        title: index === 0 ? `Needle ${needle}` : `Guide ${index}`,
        summary: index === 1 ? `Needle ${needle}` : "General help.",
        body: index === 2 ? `Needle ${needle}` : "Steps for customers.",
        category: index === 3 ? `Needle ${needle}` : "Support",
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: admin.id,
      }
    })
    await prisma.knowledgeArticle.createMany({ data: articles })

    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    for (const needle of ["title-match", "summary-match", "body-match", "category-match"]) {
      const response = await searchKnowledgeBase(
        new Request(`http://test/api/knowledge-base?q=${needle}`),
      )
      expect((await response.json()).total).toBe(1)
    }

    const firstPage = await searchKnowledgeBase(
      new Request("http://test/api/knowledge-base?limit=5&page=1"),
    )
    const firstPageBody = await firstPage.json()
    expect(firstPageBody.articles).toHaveLength(5)
    expect(firstPageBody.total).toBe(16)
    expect(firstPageBody.limit).toBe(5)
    expect(
      (
        await searchKnowledgeBase(
          new Request("http://test/api/knowledge-base?limit=51"),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await searchKnowledgeBase(
          new Request("http://test/api/knowledge-base?q="),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await searchKnowledgeBase(
          new Request(`http://test/api/knowledge-base?q=${"x".repeat(121)}`),
        )
      ).status,
    ).toBe(400)
  })

  it("rejects duplicate slugs and keeps staff-only management endpoints private", async () => {
    const admin = await createUser("ADMIN")
    signInAs({ id: admin.id, name: admin.name, role: "ADMIN" })
    expect(
      (
        await createArticle(
          jsonRequest("http://test/api/admin/articles", "POST", validArticle),
        )
      ).status,
    ).toBe(201)
    const duplicate = await createArticle(
      jsonRequest("http://test/api/admin/articles", "POST", validArticle),
    )
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).fieldErrors.slug).toBeDefined()

    const customerUser = await createUser("CUSTOMER")
    signInAs({ id: customerUser.id, name: customerUser.name, role: "CUSTOMER" })
    expect((await getAdminArticles(new Request("http://test"))).status).toBe(403)

    signInAs(null)
    expect((await searchKnowledgeBase(new Request("http://test"))).status).toBe(401)
  })
})
