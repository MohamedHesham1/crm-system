-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Ticket_deletedAt_idx" ON "Ticket"("deletedAt");
