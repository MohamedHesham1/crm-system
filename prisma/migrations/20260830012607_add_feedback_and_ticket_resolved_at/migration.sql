-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" DATETIME;

-- Backfill: tickets already terminal when this column landed have no recorded
-- resolution moment. `updatedAt` is the best available approximation and is
-- explicitly an approximation — it is the reason the reports page shows
-- averages, not per-ticket resolution times. Rows resolved after this migration
-- get an exact `resolvedAt` from the PATCH handler.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_ticketId_key" ON "Feedback"("ticketId");

-- CreateIndex
CREATE INDEX "Ticket_resolvedAt_idx" ON "Ticket"("resolvedAt");
