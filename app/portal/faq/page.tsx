import type { Metadata } from "next"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FAQ_ENTRIES } from "@/lib/faq"

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about the support portal",
}

export default function PortalFaqPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-display">Frequently asked questions</h1>
        <p className="text-meta text-muted-foreground">
          Still stuck? Raise a ticket and an agent will pick it up.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/portal/knowledge-base">Search all help articles</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {FAQ_ENTRIES.map((entry) => (
          <Card key={entry.question}>
            <CardHeader>
              <CardTitle>{entry.question}</CardTitle>
            </CardHeader>
            <CardContent className="text-body text-muted-foreground">{entry.answer}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
