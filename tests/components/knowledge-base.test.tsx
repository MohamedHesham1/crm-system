import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithQuery } from "@/tests/helpers/render"

const { fetchKnowledgeBaseMock, fetchKnowledgeArticleMock } = vi.hoisted(() => ({
  fetchKnowledgeBaseMock: vi.fn(),
  fetchKnowledgeArticleMock: vi.fn(),
}))

vi.mock("@/lib/articles", () => ({
  articleKeys: {
    all: ["articles"],
    search: (query: string, page = 1) => ["articles", "search", query, page],
    detail: (slug: string) => ["articles", "detail", slug],
  },
  fetchKnowledgeBase: fetchKnowledgeBaseMock,
  fetchKnowledgeArticle: fetchKnowledgeArticleMock,
}))

import { KnowledgeBaseSearch } from "@/components/portal/knowledge-base/knowledge-base-search"
import { KnowledgeArticle } from "@/components/portal/knowledge-base/knowledge-article"

describe("knowledge base portal", () => {
  it("searches articles and links matching results to their published detail", async () => {
    const user = userEvent.setup()
    fetchKnowledgeBaseMock.mockImplementation(async (query: string) => ({
      articles: query
        ? [
            {
              id: "article-1",
              title: "Invoice guide",
              slug: "invoice-guide",
              summary: "How to reconcile a payment.",
              category: "Billing",
              publishedAt: new Date().toISOString(),
              author: { id: "admin-1", name: "Admin" },
            },
          ]
        : [],
      page: 1,
      limit: 10,
      total: query ? 1 : 0,
    }))

    renderWithQuery(<KnowledgeBaseSearch />)
    await user.type(await screen.findByRole("textbox", { name: "Search help articles" }), "invoice")
    await user.click(screen.getByRole("button", { name: "Search articles" }))

    const link = await screen.findByRole("link", { name: "Invoice guide" })
    expect(link).toHaveAttribute("href", "/portal/knowledge-base/invoice-guide")
    expect(screen.getByText("Billing")).toBeInTheDocument()
  })

  it("renders article bodies as text rather than interpreting markup", async () => {
    fetchKnowledgeArticleMock.mockResolvedValue({
      id: "article-1",
      title: "Invoice guide",
      slug: "invoice-guide",
      summary: "How to reconcile a payment.",
      body: "<script>alert('not markup')</script>\nCheck your account ledger.",
      category: "Billing",
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "admin-1", name: "Admin" },
    })

    renderWithQuery(<KnowledgeArticle slug="invoice-guide" />)

    expect(await screen.findByRole("heading", { name: "Invoice guide" })).toBeInTheDocument()
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument()
    expect(document.querySelector("script")).toBeNull()
  })
})
