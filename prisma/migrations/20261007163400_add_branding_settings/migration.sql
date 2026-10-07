-- CreateTable
CREATE TABLE "BrandingSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationName" TEXT NOT NULL,
    "primaryLight" TEXT NOT NULL,
    "primaryDark" TEXT NOT NULL,
    "accentLight" TEXT NOT NULL,
    "accentDark" TEXT NOT NULL,
    "logoAttachmentId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BrandingSettings_logoAttachmentId_fkey" FOREIGN KEY ("logoAttachmentId") REFERENCES "Attachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandingSettings_logoAttachmentId_key" ON "BrandingSettings"("logoAttachmentId");

-- Seed installation-wide values matching the shipped light/dark identity.
INSERT INTO "BrandingSettings"
    ("id", "organizationName", "primaryLight", "primaryDark", "accentLight", "accentDark", "updatedAt")
VALUES
    ('installation', 'Meridian', '#086071', '#61bcc6', '#e08829', '#f1ab4a', CURRENT_TIMESTAMP);
