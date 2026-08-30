/**
 * The portal FAQ. **Hardcoded on purpose** — the story explicitly rules out a
 * database table and a searchable knowledge base. Editing this array and
 * redeploying is the whole publishing workflow.
 *
 * Answers must stay consistent with behaviour Stories 04–06 actually ship. The
 * SLA figures below come from `SLA_HOURS` in `lib/sla.ts:16–20`; if that table
 * changes, change these strings in the same commit.
 */
export type FaqEntry = { question: string; answer: string }

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "How do I raise a support ticket?",
    answer:
      "Open “My tickets” and choose “New ticket”. Give it a subject, a category, a priority and a description. It reaches our queue the moment you submit it.",
  },
  {
    question: "How quickly will someone respond?",
    answer:
      "Target response times are 4 hours for HIGH priority, 24 hours for MEDIUM and 72 hours for LOW, measured from when the ticket is created. Tickets past their target are flagged to our agents automatically.",
  },
  {
    question: "What do the ticket statuses mean?",
    answer:
      "OPEN means the ticket is waiting to be picked up. IN_PROGRESS means an agent is working on it. RESOLVED means we believe it is fixed. CLOSED means the ticket is finished and archived.",
  },
  {
    question: "Can I add more information after submitting?",
    answer:
      "Yes. Open the ticket and post a comment. Comments are visible to you and to the agent handling the ticket, and the thread updates while you have the page open.",
  },
  {
    question: "Why can I only see some tickets?",
    answer:
      "The portal shows tickets belonging to your own customer profile and nothing else. If a ticket you expected is missing, it was most likely raised under a different account — tell us in a new ticket and we will link it.",
  },
  {
    question: "Can I change a ticket's priority after submitting it?",
    answer:
      "Not from the portal. Add a comment explaining the urgency and the agent handling your ticket can adjust it.",
  },
  {
    question: "How do I update my contact details?",
    answer:
      "Raise a ticket in the “Account” category with the details you want changed. Customer profiles are maintained by our team, so we make the change and confirm it on the ticket.",
  },
]
