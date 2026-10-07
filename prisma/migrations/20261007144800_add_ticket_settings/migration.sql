CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "TicketCategory_normalizedName_key" ON "TicketCategory"("normalizedName");
CREATE INDEX "TicketCategory_active_sortOrder_idx" ON "TicketCategory"("active", "sortOrder");

CREATE TABLE "SlaTarget" (
    "priority" TEXT NOT NULL PRIMARY KEY,
    "responseHours" INTEGER NOT NULL,
    "resolutionHours" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "TicketCategory" ("id", "name", "normalizedName", "active", "sortOrder", "updatedAt")
VALUES ('default-ticket-category-billing', 'Billing', 'billing', true, 0, CURRENT_TIMESTAMP);

INSERT INTO "SlaTarget" ("priority", "responseHours", "resolutionHours", "updatedAt")
VALUES
    ('HIGH', 4, 4, CURRENT_TIMESTAMP),
    ('MEDIUM', 24, 24, CURRENT_TIMESTAMP),
    ('LOW', 72, 72, CURRENT_TIMESTAMP);
